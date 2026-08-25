import type { ModalComponent } from '@afilmory/ui'
import { Button, DialogDescription, DialogHeader, DialogTitle, Prompt } from '@afilmory/ui'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useExecuteTenantCleanupMutation, useTenantCleanupCandidatesQuery } from '../hooks'

export const TenantCleanupModal: ModalComponent = ({ dismiss }) => {
  const { t } = useTranslation()
  const query = useTenantCleanupCandidatesQuery(true)
  const execute = useExecuteTenantCleanupMutation()
  const data = query.data

  const handleExecute = () => {
    if (!data || data.candidates.length === 0) {
      return
    }
    Prompt.input({
      title: t('superadmin.cleanup.confirm-title'),
      description: t('superadmin.cleanup.confirm-description', { confirmation: data.confirmation }),
      placeholder: data.confirmation,
      variant: 'danger',
      onConfirm: async (confirmation) => {
        if (confirmation.trim() !== data.confirmation) {
          toast.error(t('superadmin.cleanup.confirm-mismatch'))
          return
        }
        const result = await execute.mutateAsync({
          inactiveMonths: data.inactiveMonths,
          tenantIds: data.candidates.map(candidate => candidate.id),
          confirmation,
        })
        toast.success(
          t('superadmin.cleanup.complete', {
            deletedCount: result.deletedCount,
            skippedCount: result.skippedCount,
            failedCount: result.failedCount,
          }),
        )
        dismiss()
      },
    })
  }

  return (
    <div className="flex max-h-[80vh] flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('superadmin.cleanup.title')}</DialogTitle>
        <DialogDescription>{t('superadmin.cleanup.description')}</DialogDescription>
      </DialogHeader>
      {query.isLoading ? <p className="text-text-secondary text-sm">{t('superadmin.cleanup.loading')}</p> : null}
      {query.isError ? <p className="text-red text-sm">{t('superadmin.cleanup.error')}</p> : null}
      {data ? (
        <>
          <div className="grid grid-cols-3 gap-px overflow-hidden border border-border/40 bg-border/40">
            <Metric label={t('superadmin.cleanup.candidates')} value={data.total} />
            <Metric label={t('superadmin.cleanup.inactive-months')} value={data.inactiveMonths} />
            <Metric label={t('superadmin.cleanup.cutoff')} value={new Date(data.cutoff).toLocaleDateString()} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto border border-border/40">
            <table className="min-w-full divide-y divide-border/40 text-sm">
              <thead className="sticky top-0 bg-background-secondary">
                <tr>
                  <th className="px-3 py-2 text-left">{t('superadmin.cleanup.workspace')}</th>
                  <th className="px-3 py-2 text-left">{t('superadmin.cleanup.owner')}</th>
                  <th className="px-3 py-2 text-left">{t('superadmin.cleanup.created')}</th>
                  <th className="px-3 py-2 text-left">{t('superadmin.cleanup.last-active')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {data.candidates.map(candidate => (
                  <tr key={candidate.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium">{candidate.name}</div>
                      <div className="text-text-tertiary text-xs">{candidate.slug}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{candidate.ownerName ?? '—'}</div>
                      <div className="text-text-tertiary text-xs">{candidate.ownerEmail ?? '—'}</div>
                    </td>
                    <td className="px-3 py-3">{new Date(candidate.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3">{new Date(candidate.lastActivityAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {data.candidates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-text-secondary px-3 py-10 text-center">
                      {t('superadmin.cleanup.empty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={dismiss}>
              {t('superadmin.cleanup.cancel')}
            </Button>
            <Button variant="destructive" disabled={data.total === 0 || execute.isPending} onClick={handleExecute}>
              {t('superadmin.cleanup.execute', { count: data.total })}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}

TenantCleanupModal.contentClassName = 'max-w-5xl w-[92vw]'

function Metric({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-text-tertiary text-xs">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  )
}
