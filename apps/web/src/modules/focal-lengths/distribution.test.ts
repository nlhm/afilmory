import { describe, expect, it } from 'vitest'

import { parseFocalLength } from '../../lib/exif-focal-length'
import type { PhotoManifest } from '../../types/photo'
import { getFocalLengthDistribution, getLensOptions, getMostUsedFocalGroup } from './distribution'

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

  it('groups and numerically sorts actual focal lengths without substituting equivalents', () => {
    const result = getFocalLengthDistribution(photos)
    expect(result.groups.map(group => [group.focalLength, group.count])).toEqual([
      [23.5, 1],
      [35, 2],
      [70, 1],
    ])
    expect(result.groups[1].photos.map(photo => photo.id)).toEqual(['b', 'c'])
    expect(result.groups.some(group => group.focalLength === 50)).toBe(false)
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
    expect(getMostUsedFocalGroup(groups)?.focalLength).toBe(24)
    expect(getMostUsedFocalGroup(getFocalLengthDistribution(photos).groups)?.focalLength).toBe(35)
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
})
