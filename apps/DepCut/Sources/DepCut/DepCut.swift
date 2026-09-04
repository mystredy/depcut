import AppKit

// DepCut runs on the AppKit lifecycle: every surface — the menu bar status item, onboarding,
// login, and the application menu — is built and owned by DepCutAppDelegate. There is no
// SwiftUI scene, so nothing injects a "Settings…" item or competes with the delegate's
// own main menu (which already exposes Permissions Setup, Sign Out, and Show Onboarding).
@main
enum DepCutMain {
    static func main() {
        let app = NSApplication.shared
        let delegate = DepCutAppDelegate()
        app.delegate = delegate
        // NSApplication holds the delegate weakly; keep it alive for the whole run loop.
        withExtendedLifetime(delegate) {
            app.run()
        }
    }
}
