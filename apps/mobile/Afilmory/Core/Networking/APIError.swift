import Foundation

enum APIError: Error {
  case unauthorized
  case http(status: Int, body: String?)
  case transport(Error)
  case decoding(Error)
  case cancelled

  static func response(status: Int, body: Data?) -> APIError? {
    guard !(200..<300).contains(status) else { return nil }
    if status == 401 {
      return .unauthorized
    }
    let text = body.flatMap { String(data: $0, encoding: .utf8) }
    return .http(status: status, body: text?.isEmpty == false ? text : nil)
  }

  static func request(_ error: Error) -> APIError {
    if error is CancellationError || (error as? URLError)?.code == .cancelled {
      return .cancelled
    }
    if let error = error as? APIError {
      return error
    }
    return .transport(error)
  }
}

extension APIError: LocalizedError {
  var errorDescription: String? {
    switch self {
    case .unauthorized:
      "Authentication is required."
    case .http(let status, let body):
      body ?? "The server returned HTTP \(status)."
    case .transport(let error), .decoding(let error):
      error.localizedDescription
    case .cancelled:
      "The request was cancelled."
    }
  }
}
