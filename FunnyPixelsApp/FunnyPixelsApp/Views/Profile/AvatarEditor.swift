import SwiftUI
import PhotosUI

/// 头像预览器/编辑器
/// 显示当前头像大图预览，支持更换头像
struct AvatarEditor: View {
    @Binding var isPresented: Bool
    @Binding var avatarData: String?
    @ObservedObject private var fontManager = FontSizeManager.shared
    let initialAvatarData: String?  // 初始头像数据（用于预览）
    let avatarUrl: String?           // CDN头像URL
    let displayName: String          // 用户名（用于占位符）
    let onSave: (String) -> Void

    @State private var selectedItem: PhotosPickerItem?
    @State private var showActionMenu = false
    @State private var showImagePicker = false
    @State private var showPhotosPicker = false
    @State private var sourceType: UIImagePickerController.SourceType = .photoLibrary
    @State private var convertedPixelData: String?
    @State private var showDisclaimer = false

    // 计算属性：获取应该显示的头像数据（像素数据）
    private var displayPixelData: String? {
        convertedPixelData ?? avatarData ?? initialAvatarData
    }

    // 是否有新编辑的像素数据
    private var hasNewPixelData: Bool {
        if let data = displayPixelData, data.contains(",") {
            return true
        }
        return false
    }

    private let gridSize = 32

    // 检查相机是否可用
    private var isCameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                VStack {
                    Spacer()

                    // 大头像预览（优先显示CDN图片，否则显示像素数据）
                    Group {
                        if hasNewPixelData, let pixelData = displayPixelData {
                            // 编辑中的新头像（像素艺术预览）
                            PixelAvatarView(
                                pixelData: pixelData,
                                size: 280
                            )
                            .frame(width: 280, height: 280)
                            .clipShape(Circle())
                            .shadow(color: .black.opacity(0.5), radius: 20, y: 10)
                        } else if let url = avatarUrl, !url.isEmpty {
                            // 当前头像（CDN图片）
                            AvatarView(
                                avatarUrl: url,
                                displayName: displayName,
                                size: 280
                            )
                            .shadow(color: .black.opacity(0.5), radius: 20, y: 10)
                        } else {
                            // 默认头像（首字母）
                            Circle()
                                .fill(Color.gray.opacity(0.3))
                                .frame(width: 280, height: 280)
                                .overlay(
                                    Text(displayName.prefix(1).uppercased())
                                        .font(.system(size: 120, weight: .semibold))
                                        .foregroundColor(.white)
                                )
                                .shadow(color: .black.opacity(0.5), radius: 20, y: 10)
                        }
                    }

                    Spacer()
                }
            }
            .navigationTitle(NSLocalizedString("avatar.preview.title", value: "头像", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.close", value: "关闭", comment: "")) {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showActionMenu = true
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 20))
                    }
                }
            }
            .confirmationDialog(NSLocalizedString("avatar.menu.title", value: "选择操作", comment: ""), isPresented: $showActionMenu, titleVisibility: .hidden) {
                // 更换头像选项
                Button(NSLocalizedString("avatar.menu.change", value: "更换头像", comment: "")) {
                    showPhotosPicker = true
                }

                if isCameraAvailable {
                    Button(NSLocalizedString("avatar.menu.take_photo", value: "拍照", comment: "")) {
                        sourceType = .camera
                        showImagePicker = true
                    }
                }

                // 保存图片（仅当有头像时显示）
                if avatarUrl != nil || hasNewPixelData {
                    Button(NSLocalizedString("avatar.menu.save", value: "保存到相册", comment: "")) {
                        Task {
                            await saveImageToPhotos()
                        }
                    }
                }

                // 内容规范
                Button(NSLocalizedString("avatar.menu.guidelines", value: "内容规范", comment: "")) {
                    showDisclaimer = true
                }

                Button(NSLocalizedString("common.cancel", value: "取消", comment: ""), role: .cancel) { }
            }
            .alert(NSLocalizedString("disclaimer.title", value: "内容规范", comment: ""), isPresented: $showDisclaimer) {
                Button(NSLocalizedString("common.confirm", value: "我知道了", comment: ""), role: .cancel) { }
            } message: {
                Text(NSLocalizedString("disclaimer.avatar", value: "请确保您的头像内容符合社区规范，不包含违法、色情、暴力或侵权内容。违规内容将被删除，严重者将被封禁账号。", comment: ""))
            }
            .sheet(isPresented: $showImagePicker) {
                ImagePicker(sourceType: sourceType) { image in
                    if let uiImage = image {
                        convertImageToPixels(uiImage)
                    }
                    showImagePicker = false
                }
            }
            .photosPicker(
                isPresented: $showPhotosPicker,
                selection: $selectedItem,
                matching: .images
            )
            .onChange(of: selectedItem) { _, newItem in
                Task {
                    await loadImageAndConvert(from: newItem)
                }
                showPhotosPicker = false
            }
            .onAppear {
                loadExistingAvatar()
            }
        }
    }

    // MARK: - Image Loading and Conversion

    private func loadImageAndConvert(from item: PhotosPickerItem?) async {
        guard let item = item else { return }

        do {
            if let data = try await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                await MainActor.run {
                    convertImageToPixels(uiImage)
                }
            }
        } catch {
            Logger.error("Failed to load image: \(error)")
        }

        selectedItem = nil
    }

    private func convertImageToPixels(_ image: UIImage) {
        // Create CGContext with explicit RGBA byte order (Big-endian = R,G,B,X).
        // UIGraphicsBeginImageContext uses BGRA on little-endian iOS ARM,
        // which causes R/B channel swap when reading raw bytes.
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bytesPerPixel = 4
        let bytesPerRow = gridSize * bytesPerPixel
        let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.noneSkipLast.rawValue

        guard let context = CGContext(
            data: nil,
            width: gridSize,
            height: gridSize,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else { return }

        context.interpolationQuality = .none

        // Flip to UIKit coordinate system (origin top-left)
        context.translateBy(x: 0, y: CGFloat(gridSize))
        context.scaleBy(x: 1, y: -1)

        // Draw image via UIKit to handle image orientation correctly
        UIGraphicsPushContext(context)
        image.draw(in: CGRect(x: 0, y: 0, width: gridSize, height: gridSize))
        UIGraphicsPopContext()

        guard let rawData = context.data else { return }
        let dataPointer = rawData.assumingMemoryBound(to: UInt8.self)

        var newPixels: [String] = []
        for y in 0..<gridSize {
            for x in 0..<gridSize {
                let offset = y * bytesPerRow + x * bytesPerPixel
                let r = dataPointer[offset]
                let g = dataPointer[offset + 1]
                let b = dataPointer[offset + 2]
                let color = String(format: "%02X%02X%02X", r, g, b)
                newPixels.append(color)
            }
        }

        // 保存为逗号分隔的字符串
        convertedPixelData = newPixels.joined(separator: ",")
        avatarData = convertedPixelData  // 更新绑定以便预览刷新
        // 自动保存
        if let data = convertedPixelData {
            onSave(data)
        }
        Logger.info("✅ 图片已转换为像素数据: \(newPixels.count) 像素")
    }

    private func saveImageToPhotos() async {
        guard let pixelData = displayPixelData,
              !pixelData.isEmpty else { return }

        // 在后台线程处理图片生成
        let image = await Task.detached(priority: .userInitiated) {
            // 解析像素数据
            let colorStrings = pixelData.split(separator: ",").compactMap { String($0) }

            // 创建200×200的图片
            let outputSize: CGFloat = 200
            let pixelSize = outputSize / CGFloat(gridSize)

            let renderer = UIGraphicsImageRenderer(size: CGSize(width: outputSize, height: outputSize))
            return renderer.image { context in
                for (index, colorString) in colorStrings.enumerated() {
                    if let color = Color(hex: colorString), let cgColor = color.cgColor {
                        let x = CGFloat(index % gridSize) * pixelSize
                        let y = CGFloat(index / gridSize) * pixelSize
                        context.cgContext.setFillColor(cgColor)
                        context.cgContext.fill(CGRect(x: x, y: y, width: pixelSize, height: pixelSize))
                    }
                }
            }
        }.value

        // 保存到相册
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
        Logger.info("✅ 图片已保存到相册")
    }

    // MARK: - Data Management

    private func loadExistingAvatar() {
        Logger.debug("📸 AvatarEditor: loadExistingAvatar called")
        Logger.debug("📸 avatarData binding value: \(avatarData ?? "nil")")
        Logger.debug("📸 initialAvatarData value: \(initialAvatarData ?? "nil")")

        // 优先使用avatarData，如果为nil则使用initialAvatarData
        let existingData = avatarData ?? initialAvatarData

        guard let existingData = existingData else {
            Logger.debug("📸 No existing avatar data, using placeholder")
            return
        }
        guard !existingData.isEmpty else {
            Logger.debug("📸 Avatar data is empty, using placeholder")
            return
        }
        guard existingData.contains(",") else {
            Logger.debug("📸 Avatar data doesn't contain comma, using placeholder")
            return
        }

        convertedPixelData = existingData
        Logger.debug("📸 Avatar data loaded: \(existingData.prefix(50))...")
    }
}

// MARK: - ImagePicker (UIImagePickerController wrapper)

struct ImagePicker: UIViewControllerRepresentable {
    let sourceType: UIImagePickerController.SourceType
    let onImagePicked: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let uiImage = info[.originalImage] as? UIImage {
                parent.onImagePicked(uiImage)
            }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.onImagePicked(nil)
        }
    }
}

// MARK: - Preview

#Preview("With Avatar") {
    AvatarEditor(
        isPresented: .constant(true),
        avatarData: .constant("#FF0000,#00FF00,#0000FF,#FFFF00,#FF00FF,#00FFFF,#FFFFFF,#000000"),
        initialAvatarData: "#FF0000,#00FF00,#0000FF,#FFFF00,#FF00FF,#00FFFF,#FFFFFF,#000000",
        avatarUrl: "uploads/avatars/test_user.png",
        displayName: "TestUser"
    ) { _ in }
}

#Preview("Empty Avatar") {
    AvatarEditor(
        isPresented: .constant(true),
        avatarData: .constant(nil),
        initialAvatarData: nil,
        avatarUrl: nil,
        displayName: "User"
    ) { _ in }
}
