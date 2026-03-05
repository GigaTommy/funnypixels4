import SwiftUI
import WebKit

/// 协议/政策查看器弹窗
/// 在应用内展示用户协议、隐私政策等HTML内容
struct PolicyViewerSheet: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let title: String
    let url: String
    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = true
    @State private var loadError: String?

    var body: some View {
        NavigationView {
            ZStack {
                if let error = loadError {
                    // 错误状态
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 50))
                            .foregroundColor(.orange)

                        Text(LocalizedStringKey("policy.failed_load"))
                            .font(.headline)

                        Text(error)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)

                        Button(LocalizedStringKey("policy.retry")) {
                            isLoading = true
                            loadError = nil
                        }
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .padding()
                } else if isLoading {
                    // 加载状态
                    ProgressView(LocalizedStringKey("policy.loading"))
                        .scaleEffect(1.5)
                }

                // WebView - 加载远程URL内容
                RemoteWebView(urlString: url, isLoading: $isLoading, loadError: $loadError)
                    .opacity(isLoading || loadError != nil ? 0 : 1)
            }
            .navigationTitle(LocalizedStringKey(title))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(LocalizedStringKey("policy.close")) {
                        dismiss()
                    }
                }
            }
        }
    }

    // 备用：之前的本地硬编码内容（保留作为最后的保底）
    private var fallbackContent: String {
        // iOS 16+ check for language code
        let languageCode: String?
        if #available(iOS 16, *) {
            languageCode = Locale.current.language.languageCode?.identifier
        } else {
            languageCode = Locale.current.languageCode
        }
        let isChinese = languageCode == "zh"
        
        switch title.lowercased() {
        case "用户协议", "user agreement", "terms", "terms of service", "服务条款":
            return isChinese ? UserAgreementHTML.content : UserAgreementHTML_EN.content
        case "隐私政策", "privacy policy", "privacy":
            return isChinese ? PrivacyPolicyHTML.content : PrivacyPolicyHTML_EN.content
        default:
            return "<html><body><h1>Content failed to load (Unknown Title: \(title))</h1></body></html>"
        }
    }
}

/// 远程 URL WebView 组件
struct RemoteWebView: UIViewRepresentable {
    let urlString: String
    @Binding var isLoading: Bool
    @Binding var loadError: String?

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // 允许内联播放视频，如果不设置，某些PDF可能显示异常
        configuration.allowsInlineMediaPlayback = true
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        
        // 禁止回弹效果
        webView.scrollView.bounces = false
        
        if let url = URL(string: urlString) {
            let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 30)
            webView.load(request)
        } else {
            DispatchQueue.main.async {
                self.loadError = "Invalid URL: \(urlString)"
                self.isLoading = false
            }
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // 不做任何操作
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: RemoteWebView

        init(_ parent: RemoteWebView) {
            self.parent = parent
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = true
                self.parent.loadError = nil
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            // 忽略取消错误（-999）
            if (error as NSError).code != NSURLErrorCancelled {
                DispatchQueue.main.async {
                    self.parent.isLoading = false
                    self.parent.loadError = error.localizedDescription
                }
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            // 忽略取消错误（-999）
            if (error as NSError).code != NSURLErrorCancelled {
                DispatchQueue.main.async {
                    self.parent.isLoading = false
                    self.parent.loadError = error.localizedDescription
                }
            }
        }
    }
}

// MARK: - English Policy Content
enum UserAgreementHTML_EN {
    static let content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Agreement</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 16px;
                line-height: 1.8;
                color: #333;
                font-size: 15px;
            }
            h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; color: #000; text-align: center; }
            h2 { font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 12px; color: #1890ff; }
            .date { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f0f0f0; }
            p { margin-bottom: 12px; text-align: justify; }
        </style>
    </head>
    <body>
        <h1>FunnyPixels User Agreement</h1>
        <p class="date">Updated: January 1, 2024</p>
        <h2>1. Acceptance of Terms</h2>
        <p>Welcome to FunnyPixels. By using this application, you agree to comply with and be bound by the following terms.</p>
        <h2>2. Services</h2>
        <p>FunnyPixels is a location-based pixel drawing application where users can draw on a global map and collaborate with others.</p>
    </body>
    </html>
    """
}

enum PrivacyPolicyHTML_EN {
    static let content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Privacy Policy</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 16px;
                line-height: 1.8;
                color: #333;
                font-size: 15px;
            }
            h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; color: #000; text-align: center; }
            h2 { font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 12px; color: #1890ff; }
            .date { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f0f0f0; }
        </style>
    </head>
    <body>
        <h1>FunnyPixels Privacy Policy</h1>
        <p class="date">Effective Date: January 1, 2024</p>
        <h2>1. Information We Collect</h2>
        <p>We collect account information, location data (with your consent), and device information to provide our services.</p>
    </body>
    </html>
    """
}

/// 本地HTML WebView组件
struct LocalWebView: UIViewRepresentable {
    let htmlContent: String
    @Binding var isLoading: Bool
    @Binding var loadError: String?

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.dataDetectorTypes = []
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator

        // 加载HTML字符串
        webView.loadHTMLString(htmlContent, baseURL: nil)

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // 不做任何操作
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: LocalWebView

        init(_ parent: LocalWebView) {
            self.parent = parent
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
            parent.loadError = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            // 忽略取消错误（-999）
            if (error as NSError).code != NSURLErrorCancelled {
                parent.isLoading = false
                parent.loadError = error.localizedDescription
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            // 忽略取消错误（-999）
            if (error as NSError).code != NSURLErrorCancelled {
                parent.isLoading = false
                parent.loadError = error.localizedDescription
            }
        }
    }
}

// MARK: - 用户协议HTML内容
enum UserAgreementHTML {
    static let content = """
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>用户协议</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
                padding: 16px;
                line-height: 1.8;
                color: #333;
                font-size: 15px;
            }
            h1 {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 12px;
                color: #000;
                text-align: center;
            }
            h2 {
                font-size: 18px;
                font-weight: 600;
                margin-top: 24px;
                margin-bottom: 12px;
                color: #1890ff;
            }
            .date {
                text-align: center;
                color: #666;
                font-size: 14px;
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 1px solid #f0f0f0;
            }
            p {
                margin-bottom: 12px;
                text-align: justify;
            }
            ul, ol {
                margin-left: 20px;
                margin-bottom: 12px;
            }
            li {
                margin-bottom: 8px;
            }
        </style>
    </head>
    <body>
        <h1>《FunnyPixels》用户使用协议</h1>
        <p class="date">更新日期：2024年1月1日</p>

        <h2>1. 协议的接受</h2>
        <p>欢迎使用FunnyPixels（以下简称"本应用"）。本协议是您与本应用之间就使用本应用所订立的协议。请您仔细阅读本协议，特别是免除或限制责任的条款。</p>
        <p>点击"登录"或"注册"按钮，即表示您已阅读、理解并同意接受本协议的约束。</p>

        <h2>2. 服务内容</h2>
        <p>本应用是一款基于地理位置的像素绘制应用，用户可以在真实地图上绘制像素，与其他用户共同创作。</p>
        <p>具体功能包括但不限于：</p>
        <ul>
            <li>在地图上绘制像素</li>
            <li>查看其他用户的像素作品</li>
            <li>创建或加入联盟</li>
            <li>GPS自动绘制</li>
        </ul>

        <h2>3. 用户注册与账号</h2>
        <p>3.1 用户在注册时，应提供真实、准确、完整的个人资料。</p>
        <p>3.2 用户应对其账号的安全性负责，妥善保管账号和密码。</p>
        <p>3.3 用户不得将账号转让或借给他人使用。</p>

        <h2>4. 用户行为规范</h2>
        <p>4.1 用户在使用本应用时，必须遵守相关法律法规，不得利用本应用从事违法违规活动。</p>
        <p>4.2 用户不得发布以下内容：</p>
        <ul>
            <li>违反法律法规的内容</li>
            <li>侵犯他人知识产权或其他合法权益的内容</li>
            <li>淫秽、色情、暴力、恐怖等内容</li>
            <li>虚假信息、诈骗信息</li>
            <li>垃圾信息或恶意广告</li>
        </ul>

        <h2>5. 知识产权</h2>
        <p>5.1 本应用的所有内容，包括但不限于文字、图片、软件等，其知识产权归本应用所有。</p>
        <p>5.2 用户绘制的像素作品，用户享有署名权，但授权本应用在全球范围内免费、非独家地使用、展示和传播。</p>

        <h2>6. 免责声明</h2>
        <p>6.1 本应用不对用户发布的内容的准确性、完整性和安全性承担责任。</p>
        <p>6.2 因不可抗力、网络故障等原因导致服务中断或终止，本应用不承担责任。</p>
        <p>6.3 用户因使用本应用而与他人产生的纠纷，由用户自行解决。</p>

        <h2>7. 协议的修改</h2>
        <p>本应用有权根据需要修改本协议，修改后的协议一经公布即代替原协议。如您不同意修改后的协议，可以停止使用本应用。</p>

        <h2>8. 法律适用</h2>
        <p>本协议的订立、执行和解释均适用中华人民共和国法律。如发生纠纷，双方应友好协商解决；协商不成的，任何一方均可向本应用所在地人民法院提起诉讼。</p>

        <p style="margin-top: 24px; text-align: center; color: #666;">感谢您使用FunnyPixels！</p>
    </body>
    </html>
    """
}

// MARK: - 隐私政策HTML内容
enum PrivacyPolicyHTML {
    static let content = """
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>隐私政策</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
                padding: 16px;
                line-height: 1.8;
                color: #333;
                font-size: 15px;
            }
            h1 {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 12px;
                color: #000;
                text-align: center;
            }
            h2 {
                font-size: 18px;
                font-weight: 600;
                margin-top: 24px;
                margin-bottom: 12px;
                color: #1890ff;
            }
            .date {
                text-align: center;
                color: #666;
                font-size: 14px;
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 1px solid #f0f0f0;
            }
            p {
                margin-bottom: 12px;
                text-align: justify;
            }
            ul, ol {
                margin-left: 20px;
                margin-bottom: 12px;
            }
            li {
                margin-bottom: 8px;
            }
        </style>
    </head>
    <body>
        <h1>《FunnyPixels》隐私政策</h1>
        <p class="date">生效日期：2024年1月1日</p>

        <h2>引言</h2>
        <p>FunnyPixels（以下简称"我们"）非常重视用户的隐私保护。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。使用我们的应用即表示您同意本隐私政策的条款。</p>

        <h2>1. 我们收集的信息</h2>
        <p>1.1 账号信息</p>
        <ul>
            <li>注册时提供的用户名、邮箱、手机号</li>
            <li>密码（加密存储）</li>
        </ul>

        <p>1.2 位置信息</p>
        <ul>
            <li>GPS位置信息（用于像素绘制和定位功能）</li>
            <li>仅在您授权后收集</li>
            <li>您可以在设置中随时关闭位置权限</li>
        </ul>

        <p>1.3 设备信息</p>
        <ul>
            <li>设备型号、操作系统版本</li>
            <li>唯一设备标识符</li>
        </ul>

        <p>1.4 使用数据</p>
        <ul>
            <li>应用使用日志</li>
            <li>像素绘制记录</li>
            <li>操作行为数据</li>
        </ul>

        <h2>2. 信息的使用</h2>
        <p>我们使用收集的信息用于：</p>
        <ul>
            <li>提供、维护和改进我们的服务</li>
            <li>处理您的请求和交易</li>
            <li>向您发送重要通知和更新</li>
            <li>分析应用使用情况，优化用户体验</li>
            <li>防止欺诈和滥用行为</li>
            <li>遵守法律法规要求</li>
        </ul>

        <h2>3. 信息的共享</h2>
        <p>除以下情况外，我们不会与第三方共享您的个人信息：</p>
        <ul>
            <li>获得您的明确同意</li>
            <li>法律法规要求或政府部门要求</li>
            <li>为保护我们的权利和财产</li>
            <li>与可信赖的服务提供商合作（在保密的前提下）</li>
        </ul>

        <h2>4. 信息的存储</h2>
        <p>4.1 我们在中华人民共和国境内存储您的个人信息。</p>
        <p>4.2 我们采取安全措施保护您的信息，防止未经授权的访问、使用或泄露。</p>
        <p>4.3 账号注销后，我们将删除或匿名化您的个人信息。</p>

        <h2>5. 您的权利</h2>
        <p>您对自己的个人信息享有以下权利：</p>
        <ul>
            <li>访问和查看您的信息</li>
            <li>更正不准确的信息</li>
            <li>删除您的个人信息</li>
            <li>撤回您的同意</li>
            <li>注销账号</li>
        </ul>
        <p>如需行使上述权利，请通过应用内的设置功能或联系我们。</p>

        <h2>6. 位置权限</h2>
        <p>6.1 我们需要您的位置权限来提供GPS绘制和地图定位功能。</p>
        <p>6.2 您可以随时在设备设置中关闭位置权限。</p>
        <p>6.3 关闭位置权限可能会影响某些功能的使用。</p>

        <h2>7. Cookie的使用</h2>
        <p>我们使用Cookie和类似技术来改善用户体验。您可以通过浏览器设置控制Cookie的使用。</p>

        <h2>8. 儿童隐私</h2>
        <p>我们的应用面向13岁以上用户。我们不会故意收集13岁以下儿童的个人信息。</p>

        <h2>9. 隐私政策的变更</h2>
        <p>我们可能会不时更新本隐私政策。更新后的政策将在应用内公布。继续使用应用即表示您接受更新后的政策。</p>

        <h2>10. 联系我们</h2>
        <p>如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：</p>
        <ul>
            <li>邮箱：privacy@funnypixels.com</li>
            <li>应用内反馈功能</li>
        </ul>

        <p style="margin-top: 24px; text-align: center; color: #666;">感谢您信任FunnyPixels！</p>
    </body>
    </html>
    """
}

#Preview {
    PolicyViewerSheet(
        title: "用户协议",
        url: ""
    )
}
