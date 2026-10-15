import { describe, expect, it } from 'vitest'

import { parseFocalLength } from '../../lib/exif-focal-length'
import type { PhotoManifest } from '../../types/photo'
import { FOCAL_LENGTH_BANDS, getFocalLengthDistribution, getLensOptions, getMostUsedFocalGroup } from './distribution'

function photo(id: string, focal: unknown, lens: string | null = 'Zoom', equivalent = '50 mm'): PhotoManifest {
  return {
    id,
    exif: {
      FocalLength: focal,
      FocalLengthIn35mmFormat: equivalent,
      LensMake: lens ? 'Test' : undefined,
      LensModel: lens ?? undefined,
    },
  } as PhotoManifest
}

const photos = [
  photo('a', '23.5 mm'),
  photo('b', 35),
  photo('c', '35.0 mm'),
  photo('d', '70 mm', 'Tele'),
  photo('e', undefined),
  photo('f', 0, null),
]

describe('actual focal length distribution', () => {
  it('preserves decimals and normalizes equivalent numeric representations', () => {
    expect(['23.5 mm', 23.5, ' 23.500 MM '].map(parseFocalLength)).toEqual([23.5, 23.5, 23.5])
    expect(parseFocalLength('0.5 mm')).toBe(0.5)
  })

  it('excludes absent, invalid and ambiguous data rather than guessing', () => {
    for (const value of [
      null,
      undefined,
      '',
      0,
      -35,
      Infinity,
      Number.NaN,
      '35-70 mm',
      '35 mm (53 mm equivalent)',
      '35px',
      {},
      true,
    ]) {
      expect(parseFocalLength(value)).toBeNull()
    }
  })

  it('groups actual focal lengths by fixed bands without substituting equivalents', () => {
    const result = getFocalLengthDistribution(photos)
    expect(result.groups.map(group => [group.band.id, group.count])).toEqual([
      ['24', 1],
      ['35', 2],
      ['85', 1],
    ])
    expect(result.groups[1].photos.map(photo => photo.id)).toEqual(['b', 'c'])
    expect(result.groups.some(group => group.band.id === '50')).toBe(false)
  })

  it('uses only valid focal lengths as the denominator and keeps missing photos accessible', () => {
    const result = getFocalLengthDistribution(photos)
    expect(result.totalCount).toBe(6)
    expect(result.validCount).toBe(4)
    expect(result.groups.map(group => group.share)).toEqual([0.25, 0.5, 0.25])
    expect(result.missingPhotos.map(photo => photo.id)).toEqual(['e', 'f'])
  })

  it('recomputes both counts and shares for one lens', () => {
    const result = getFocalLengthDistribution(photos, 'Test Zoom')
    expect(result.totalCount).toBe(4)
    expect(result.validCount).toBe(3)
    expect(result.groups.map(group => group.share)).toEqual([1 / 3, 2 / 3])
    expect(result.groups.flatMap(group => group.photos).map(photo => photo.id)).toEqual(['a', 'b', 'c'])
  })

  it('counts missing focal lengths in lens totals but never merges unknown lenses into a named lens', () => {
    expect(getLensOptions(photos)).toEqual([
      { lens: 'Test Tele', count: 1 },
      { lens: 'Test Zoom', count: 4 },
    ])
  })

  it('selects the most frequent focal length with a numeric tie break', () => {
    const groups = getFocalLengthDistribution([photo('a', 70), photo('b', 24)]).groups
    expect(getMostUsedFocalGroup(groups)?.band.id).toBe('24')
    expect(getMostUsedFocalGroup(getFocalLengthDistribution(photos).groups)?.band.id).toBe('35')
    expect(getMostUsedFocalGroup([])).toBeUndefined()
  })

  it('handles an empty or unknown lens selection without NaN percentages', () => {
    expect(getFocalLengthDistribution(photos, 'missing lens')).toEqual({
      groups: [],
      totalCount: 0,
      validCount: 0,
      missingPhotos: [],
    })
    expect(getFocalLengthDistribution([photo('missing', null)]).groups).toEqual([])
  })

  it.each(FOCAL_LENGTH_BANDS.slice(0, -1))(
    'assigns the upper boundary of %s exclusively to the next band',
    (id, _min, max) => {
      const index = FOCAL_LENGTH_BANDS.findIndex(band => band[0] === id)
      const result = getFocalLengthDistribution([
        photo('below', max - 0.001),
        photo('boundary', max),
        photo('above', max + 0.001),
      ])
      expect(result.groups.map(group => [group.band.id, group.photos.map(photo => photo.id)])).toEqual([
        [id, ['below']],
        [FOCAL_LENGTH_BANDS[index + 1][0], ['boundary', 'above']],
      ])
      expect(result.validCount).toBe(3)
    },
  )

  it('covers ultra-wide and future long lenses without displaying empty bands', () => {
    const result = getFocalLengthDistribution([
      photo('longest', 1600),
      photo('wide', 0.5),
      photo('tele', 600),
      photo('macro', 105),
      photo('standard', 55),
      photo('normal', 50),
    ])
    expect(result.groups.map(group => [group.band.id, group.count])).toEqual([
      ['ultra-wide', 1],
      ['50', 2],
      ['105', 1],
      ['600', 1],
      ['super-telephoto', 1],
    ])
    expect(result.groups[1].photos.map(photo => photo.id)).toEqual(['standard', 'normal'])
    expect(result.groups.flatMap(group => group.photos)).toHaveLength(6)
  })

  it('keeps band identifiers, boundaries and existing memberships stable when adding or selecting lenses', () => {
    const original = getFocalLengthDistribution(photos)
    const expanded = getFocalLengthDistribution([...photos, photo('future', 600, 'New lens')])
    const filtered = getFocalLengthDistribution([...photos, photo('future', 600, 'New lens')], 'Test Zoom')
    for (const group of original.groups) {
      const updated = expanded.groups.find(candidate => candidate.band.id === group.band.id)
      expect(updated?.band).toEqual(group.band)
      expect(updated?.photos).toEqual(group.photos)
      expect(updated?.count).toBe(group.count)
    }
    expect(filtered.groups).toEqual(getFocalLengthDistribution(photos, 'Test Zoom').groups)
  })

  it('condenses a zoom-heavy collection into seven bands with conserved counts and shares', () => {
    const counts = [
      [17, 1],
      [24, 8],
      [25, 1],
      [27, 1],
      [28, 4],
      [30, 1],
      [33, 2],
      [35, 2],
      [36, 2],
      [39, 2],
      [43, 1],
      [46, 1],
      [47, 3],
      [48, 2],
      [49, 1],
      [50, 1],
      [53, 1],
      [55, 11],
      [56, 1],
      [57, 2],
      [59, 1],
      [60, 1],
      [62, 1],
      [63, 4],
      [66, 1],
      [67, 2],
      [68, 3],
      [69, 1],
      [70, 3],
      [71, 2],
      [74, 1],
      [76, 4],
      [77, 1],
      [83, 1],
      [85, 2],
      [86, 2],
      [88, 1],
      [89, 1],
      [94, 2],
      [96, 1],
      [102, 2],
      [104, 1],
      [105, 43],
    ]
    const result = getFocalLengthDistribution(
      counts.flatMap(([focal, count]) =>
        Array.from({ length: count }, (_, index) => photo(`${focal}-${index}`, focal))),
    )
    expect(result.groups.map(group => [group.band.id, group.count])).toEqual([
      ['ultra-wide', 1],
      ['24', 9],
      ['28', 6],
      ['35', 8],
      ['50', 34],
      ['85', 24],
      ['105', 47],
    ])
    expect(result.validCount).toBe(129)
    expect(result.groups.reduce((sum, group) => sum + group.count, 0)).toBe(129)
    expect(result.groups.reduce((sum, group) => sum + group.share, 0)).toBeCloseTo(1)
    expect(getMostUsedFocalGroup(result.groups)?.band.id).toBe('105')
  })
})
