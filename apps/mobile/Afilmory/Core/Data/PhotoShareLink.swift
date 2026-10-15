import UIKit

enum PhotoShareLink {
  static func url(photoId: String, galleryOrigin: URL) -> URL? {
    let id = photoId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !id.isEmpty else { return nil }
    return galleryOrigin.appending(path: "photos").appending(path: id)
  }

  static func url(photoId: String, gallerySlug: String?) -> URL? {
    guard let gallerySlug,
          let origin = try? ApiEnvironmentStore.shared.galleryOrigin(slug: gallerySlug)
    else { return nil }
    return url(photoId: photoId, galleryOrigin: origin)
  }
}

enum PhotoShareActivity {
  static func present(
    photoId: String,
    gallerySlug: String?,
    from presenter: UIViewController,
    sourceView: UIView? = nil,
    barButtonItem: UIBarButtonItem? = nil
  ) {
    guard let url = PhotoShareLink.url(photoId: photoId, gallerySlug: gallerySlug) else { return }
    let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
    if let barButtonItem {
      controller.popoverPresentationController?.barButtonItem = barButtonItem
    } else if let sourceView {
      controller.popoverPresentationController?.sourceView = sourceView
      controller.popoverPresentationController?.sourceRect = sourceView.bounds
    }
    presenter.present(controller, animated: true)
  }
}
