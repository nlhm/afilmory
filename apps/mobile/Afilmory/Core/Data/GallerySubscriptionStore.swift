import Foundation

@MainActor
final class GallerySubscriptionStore {
  static let shared = GallerySubscriptionStore()

  private(set) var subscriptions: [GallerySubscriptionItem] = []

  var hasSubscriptions: Bool { !subscriptions.isEmpty }

  func cachedHasSubscriptions(userId: String) -> Bool? {
    let defaults = UserDefaults.standard
    let key = Self.cacheKey(userId: userId)
    guard defaults.object(forKey: key) != nil else { return nil }
    return defaults.bool(forKey: key)
  }

  func load(userId: String, force: Bool) async {
    if !force, !subscriptions.isEmpty {
      return
    }
    do {
      let response: GallerySubscriptionListResponse = try await AfilmoryAPI.shared.request(
        GallerySubscriptionAPI.list()
      )
      subscriptions = response.subscriptions
      UserDefaults.standard.set(hasSubscriptions, forKey: Self.cacheKey(userId: userId))
    } catch {
      if isAuthorizationFailure(error) {
        return
      }
    }
  }

  func remove(tenantId: String) {
    subscriptions.removeAll { $0.tenantId == tenantId }
  }

  private static func cacheKey(userId: String) -> String {
    "explore.hasSubscriptions.\(userId)"
  }

  private func isAuthorizationFailure(_ error: Error) -> Bool {
    if case .http(let status, _) = error as? APIError, status == 401 || status == 403 {
      return true
    }
    return false
  }
}
