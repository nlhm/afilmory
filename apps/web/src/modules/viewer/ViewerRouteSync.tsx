import { useSyncViewerCloseShortcut, useSyncViewerWithUrl } from '~/hooks/useViewerRouteSync'

export const ViewerRouteSync = () => {
  useSyncViewerWithUrl()
  useSyncViewerCloseShortcut()
  return null
}
