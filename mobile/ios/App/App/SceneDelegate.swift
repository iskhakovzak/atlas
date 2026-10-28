import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AtlasViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// The Capacitor web view with the edge swipe of Safari and native apps: a swipe from the left edge goes back a page
/// (the site's in-place page changes are history entries too), a swipe from the right goes forward again.
class AtlasViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
        bridge?.registerPluginInstance(AtlasClipboardPlugin())
    }
}

/// The copied-link suggestion (app/clipboard-suggest.tsx). `peek` only asks iOS whether the clipboard holds something
/// that looks like a web link (UIPasteboard pattern detection: no text is read and no "Allow Paste" prompt appears).
/// `read` returns the text after the customer taps the suggestion; iOS 16+ then shows its own paste permission.
@objc(AtlasClipboardPlugin)
public class AtlasClipboardPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AtlasClipboardPlugin"
    public let jsName = "AtlasClipboard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "peek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
    ]

    @objc func peek(_ call: CAPPluginCall) {
        let board = UIPasteboard.general
        guard board.hasStrings || board.hasURLs else { call.resolve(["hasLink": false]); return }
        board.detectPatterns(for: [.probableWebURL]) { result in
            let found = (try? result.get())?.contains(.probableWebURL) ?? false
            call.resolve(["hasLink": found])
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let text = UIPasteboard.general.string ?? UIPasteboard.general.url?.absoluteString ?? ""
            call.resolve(["text": String(text.prefix(2048))])
        }
    }
}
