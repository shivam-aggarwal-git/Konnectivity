import SwiftUI
import WebKit
import AVFoundation

@main
struct KonnectivityApp: App {
    var body: some Scene { WindowGroup { RolePicker() } }
}

private enum EntryRole: String, CaseIterable, Identifiable {
    case admin = "Admin", host = "Host", listener = "Listener"
    var id: String { rawValue }
    var icon: String { switch self { case .admin: "slider.horizontal.3"; case .host: "person.2.fill"; case .listener: "headphones" } }
    var detail: String { switch self { case .admin: "Sign in to SuperAdmin"; case .host: "Create a group & party"; case .listener: "Join with a room URL" } }
}
private struct RoomDestination: Identifiable { let id = UUID(); let url: URL }

private struct RolePicker: View {
    @AppStorage("server") private var server = ""
    @AppStorage("listenerName") private var name = ""
    @State private var role: EntryRole?
    @State private var roomURL = ""
    @State private var error = ""
    @State private var destination: RoomDestination?
    private let base = Color(red: 16/255, green: 26/255, blue: 43/255)
    private let accent = Color(red: 247/255, green: 179/255, blue: 157/255)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Image(systemName: "waveform.circle.fill").font(.system(size: 52)).foregroundStyle(accent)
                    Text("Konnectivity").font(.system(size: 38, weight: .bold, design: .rounded))
                    Text("Your people. One soundtrack.").foregroundStyle(.secondary).font(.title3)
                    if let role {
                        Button { self.role = nil; error = "" } label: { Label("Choose another role", systemImage: "chevron.left") }.foregroundStyle(accent)
                        Text(role.rawValue).font(.title.bold())
                        VStack(alignment: .leading, spacing: 12) {
                            Text(role == .listener ? "Full room invitation URL" : "Server URL").font(.subheadline).foregroundStyle(.secondary)
                            if role == .listener {
                                TextField("https://your-server/r/ABC123", text: $roomURL).textContentType(.URL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().modifier(ConnectionField())
                                TextField("Your name", text: $name).textContentType(.nickname).modifier(ConnectionField())
                            } else {
                                TextField("https://your-server", text: $server).textContentType(.URL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().modifier(ConnectionField())
                            }
                        }
                        if !error.isEmpty { Text(error).foregroundStyle(accent).accessibilityAddTraits(.updatesFrequently) }
                        Button { connect(role) } label: { Text(role == .listener ? "Join room" : role == .admin ? "Open SuperAdmin login" : "Create a group & party").fontWeight(.semibold).frame(maxWidth: .infinity).padding(.vertical, 16) }.buttonStyle(.borderedProminent).tint(accent).foregroundStyle(base)
                    } else {
                        Text("How are you joining?").font(.title2.bold()).padding(.top, 12)
                        ForEach(EntryRole.allCases) { choice in
                            Button { role = choice; error = "" } label: {
                                HStack(spacing: 16) {
                                    Image(systemName: choice.icon).font(.title2).frame(width: 34).foregroundStyle(accent)
                                    VStack(alignment: .leading, spacing: 5) { Text(choice.rawValue).font(.headline); Text(choice.detail).font(.subheadline).foregroundStyle(.secondary) }
                                    Spacer(); Image(systemName: "chevron.right").font(.footnote)
                                }.padding(20).frame(maxWidth: .infinity).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18))
                            }.buttonStyle(.plain)
                        }
                    }
                    Text("Connect to your private Konnectivity server. Keep the server running on your laptop while listening together.").font(.footnote).foregroundStyle(.secondary).padding(.top, 8)
                }.padding(24)
            }.background(base).preferredColorScheme(.dark)
        }.fullScreenCover(item: $destination) { target in RoomScreen(url: target.url) }
    }

    private func connect(_ role: EntryRole) {
        let raw = (role == .listener ? roomURL : server).trimmingCharacters(in: .whitespacesAndNewlines)
        guard var parts = URLComponents(string: raw), parts.scheme == "https", let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil else { error = "Enter a complete HTTPS URL."; return }
        let origin = "https://\(host)" + (parts.port.map { ":\($0)" } ?? "")
        if role == .listener {
            let segments = parts.path.split(separator: "/")
            guard segments.count == 2, segments[0] == "r", segments[1].count == 6, segments[1].allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber) }) else { error = "Paste the full room invitation containing /r/ and its code."; return }
            let nick = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(24))
            guard !nick.isEmpty else { error = "Enter your name to join."; return }
            var fragment = URLComponents(); fragment.query = parts.fragment
            var values = fragment.queryItems ?? []; values.removeAll { $0.name == "app-join" || $0.name == "app-name" }
            values.append(URLQueryItem(name: "app-join", value: "1")); values.append(URLQueryItem(name: "app-name", value: nick)); fragment.queryItems = values
            parts.percentEncodedFragment = fragment.percentEncodedQuery
            name = nick
        } else { parts.path = role == .admin ? "/admin/login" : "/groups"; parts.query = nil; parts.fragment = nil }
        guard let url = parts.url else { error = "Check the URL and try again."; return }
        server = origin; destination = RoomDestination(url: url)
    }
}

private struct ConnectionField: ViewModifier {
    func body(content: Content) -> some View { content.font(.body).padding(16).background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12)) }
}

private struct RoomScreen: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var failure = ""
    @State private var reload = UUID()
    @State private var leaving = false
    var body: some View {
        NavigationStack {
            ZStack {
                RoomWebView(url: url, failure: $failure).id(reload)
                if !failure.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "wifi.exclamationmark").font(.largeTitle)
                        Text("Cannot reach your server").font(.title2.bold())
                        Text("Keep the laptop server running and check the current share URL.").multilineTextAlignment(.center)
                        Button("Retry") { failure = ""; reload = UUID() }.buttonStyle(.borderedProminent)
                        Button("Change URL") { dismiss() }
                    }.padding(32).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(red: 16/255, green: 26/255, blue: 43/255))
                }
            }.navigationTitle("Konnectivity").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Roles", systemImage: "chevron.left") { leaving = true } } }
                .confirmationDialog("Return to role selection?", isPresented: $leaving, titleVisibility: .visible) { Button("Choose role") { dismiss() }; Button("Stay", role: .cancel) {} }
        }.preferredColorScheme(.dark)
    }
}

private struct RoomWebView: UIViewRepresentable {
    let url: URL
    @Binding var failure: String
    func makeCoordinator() -> Coordinator { Coordinator(origin: url, failure: $failure) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration(); config.allowsInlineMediaPlayback = true
        config.allowsAirPlayForMediaPlayback = true; config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator; view.uiDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true; view.isOpaque = false; view.backgroundColor = .black
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.allowAirPlay])
        view.load(URLRequest(url: url)); return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) { view.stopLoading(); view.loadHTMLString("", baseURL: nil); view.navigationDelegate = nil; view.uiDelegate = nil }
    @MainActor final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let origin: URL
        @Binding var failure: String
        init(origin: URL, failure: Binding<String>) { self.origin = origin; self._failure = failure }
        private func sameOrigin(_ url: URL) -> Bool { url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let target = action.request.url else { decisionHandler(.cancel); return }
            if action.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
            if sameOrigin(target) { decisionHandler(.allow) } else { if ["https", "http", "mailto", "tel"].contains(target.scheme ?? "") { UIApplication.shared.open(target) }; decisionHandler(.cancel) }
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let target = action.request.url { if sameOrigin(target) { webView.load(action.request) } else if ["https", "http", "mailto", "tel"].contains(target.scheme ?? "") { UIApplication.shared.open(target) } }
            return nil
        }
        private func presenter(_ webView: WKWebView) -> UIViewController? {
            var controller = webView.window?.rootViewController
            while let presented = controller?.presentedViewController { controller = presented }
            return controller
        }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            guard let controller = presenter(webView) else { completionHandler(); return }
            let alert = UIAlertController(title: "Konnectivity", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); controller.present(alert, animated: true)
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            guard let controller = presenter(webView) else { completionHandler(false); return }
            let alert = UIAlertController(title: "Konnectivity", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) }); alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in completionHandler(true) }); controller.present(alert, animated: true)
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { if (error as NSError).code != NSURLErrorCancelled { failure = error.localizedDescription } }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { if (error as NSError).code != NSURLErrorCancelled { failure = error.localizedDescription } }
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(origin.host == self.origin.host && origin.protocol == "https" ? .prompt : .deny) }
    }
}
