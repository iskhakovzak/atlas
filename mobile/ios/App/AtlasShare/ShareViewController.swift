import UIKit
import UniformTypeIdentifiers

/// "Поделиться → Atlas" on iPhone. A store app shares its product as a URL, as text with a link
/// ("Look at these https://…") or both; this extension hands everything to the Atlas app as
/// uz.atlasmarket.app://share?url=…&text=…&title=… and closes. The app opens the site's /share
/// (lib/native/links.ts), and the site finds the product link (app/share/route.ts), so nothing is parsed here.
final class ShareViewController: UIViewController {
    /// The site reads at most this much of each field (SHARED_TEXT_LIMIT in lib/market/shared-link.ts).
    private let fieldLimit = 2048
    private var started = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !started else { return }
        started = true
        Task { @MainActor in
            let shared = await readShared()
            if let link = appLink(shared) { openApp(link) }
            extensionContext?.completeRequest(returningItems: nil)
        }
    }

    private struct Shared {
        var url = ""
        var texts: [String] = []
        var title = ""
    }

    private func readShared() async -> Shared {
        var shared = Shared()
        let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
        for item in items {
            if shared.title.isEmpty, let title = item.attributedTitle?.string { shared.title = title }
            if let text = item.attributedContentText?.string, !text.isEmpty { shared.texts.append(text) }
            for provider in item.attachments ?? [] {
                if shared.url.isEmpty, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = await loadURL(provider), url.scheme == "https" || url.scheme == "http" {
                    shared.url = url.absoluteString
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                          let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    shared.texts.append(text)
                }
            }
        }
        return shared
    }

    private func loadURL(_ provider: NSItemProvider) async -> URL? {
        guard let item = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) else { return nil }
        if let url = item as? URL { return url }
        if let data = item as? Data { return URL(dataRepresentation: data, relativeTo: nil) }
        if let text = item as? String { return URL(string: text) }
        return nil
    }

    /// Percent-encodes everything but unreserved characters: a "+" in a store link must not turn into a space.
    private func encode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return String(value.prefix(fieldLimit)).addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
    }

    private func appLink(_ shared: Shared) -> URL? {
        var query: [String] = []
        if !shared.url.isEmpty { query.append("url=" + encode(shared.url)) }
        let text = shared.texts.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty { query.append("text=" + encode(text)) }
        if !shared.title.isEmpty { query.append("title=" + encode(shared.title)) }
        return URL(string: "uz.atlasmarket.app://share" + (query.isEmpty ? "" : "?" + query.joined(separator: "&")))
    }

    /// An extension cannot call UIApplication.shared; the application object is reached through the responder chain.
    private func openApp(_ url: URL) {
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = current.next
        }
    }
}
