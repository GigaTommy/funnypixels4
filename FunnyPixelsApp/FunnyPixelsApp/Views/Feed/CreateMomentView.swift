import SwiftUI
import Combine
import PhotosUI

/// 创建发布动态界面 - 遵循简约设计原则
struct CreateMomentView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CreateMomentViewModel()

    @State private var content: String = ""
    @State private var selectedHashtags: [String] = []
    @State private var selectedLocation: FeedService.LocationInfo?
    @State private var selectedImages: [UIImage] = []

    @State private var showHashtagInput = false
    @State private var showLocationPicker = false
    @State private var showImagePicker = false
    @State private var isPublishing = false

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // 文本编辑区（无边框，融入背景）
                textEditor

                // 已选内容预览
                selectedContentPreview

                Spacer()

                // 底部工具栏
                bottomToolbar
            }
            .background(FeedDesign.Colors.background)
            .navigationTitle(NSLocalizedString("feed.create.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    cancelButton
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    publishButton
                }
            }
            .sheet(isPresented: $showHashtagInput) {
                hashtagInputSheet
            }
            .sheet(isPresented: $showLocationPicker) {
                locationPickerSheet
            }
            .sheet(isPresented: $showImagePicker) {
                imagePickerSheet
            }
            .alert(NSLocalizedString("feed.create.error.title", comment: ""), isPresented: $viewModel.showError) {
                Button(NSLocalizedString("common.ok", comment: ""), role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }

    // MARK: - Text Editor

    private var textEditor: some View {
        TextEditor(text: $content)
            .font(FeedDesign.Typography.body)
            .foregroundColor(FeedDesign.Colors.text)
            .frame(minHeight: 150)
            .padding(FeedDesign.Spacing.m)
            .scrollContentBackground(.hidden)
            .background(FeedDesign.Colors.background)
            .overlay(alignment: .topLeading) {
                if content.isEmpty {
                    Text(NSLocalizedString("feed.create.placeholder", comment: ""))
                        .font(FeedDesign.Typography.body)
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                        .padding(FeedDesign.Spacing.m)
                        .padding(.top, 8)
                        .allowsHitTesting(false)
                }
            }
    }

    // MARK: - Selected Content Preview

    @ViewBuilder
    private var selectedContentPreview: some View {
        VStack(alignment: .leading, spacing: FeedDesign.Spacing.s) {
            // 已选图片
            if !selectedImages.isEmpty {
                imagePreviewGrid
            }

            // 已选位置
            if let location = selectedLocation {
                locationPreview(location)
            }

            // 已选话题
            if !selectedHashtags.isEmpty {
                hashtagPreview
            }
        }
        .padding(.horizontal, FeedDesign.Spacing.m)
    }

    private var imagePreviewGrid: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: FeedDesign.Spacing.xs) {
                ForEach(Array(selectedImages.enumerated()), id: \.offset) { index, image in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 80, height: 80)
                            .clipped()

                        // 删除按钮
                        Button {
                            selectedImages.remove(at: index)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 18))
                                .foregroundColor(FeedDesign.Colors.text)
                                .background(Color.white)
                                .clipShape(Circle())
                        }
                        .padding(4)
                    }
                }
            }
        }
    }

    private func locationPreview(_ location: FeedService.LocationInfo) -> some View {
        HStack(spacing: FeedDesign.Spacing.xs) {
            Image(systemName: "location.fill")
                .responsiveFont(.caption2)
                .foregroundColor(FeedDesign.Colors.textSecondary)

            Text(location.name ?? NSLocalizedString("feed.create.location", comment: ""))
                .font(FeedDesign.Typography.caption)
                .foregroundColor(FeedDesign.Colors.textSecondary)

            Spacer()

            Button {
                selectedLocation = nil
            } label: {
                Image(systemName: "xmark.circle")
                    .responsiveFont(.subheadline)
                    .foregroundColor(FeedDesign.Colors.textTertiary)
            }
        }
        .padding(.vertical, FeedDesign.Spacing.xs)
        .padding(.horizontal, FeedDesign.Spacing.s)
        .overlay(
            Rectangle()
                .stroke(FeedDesign.Colors.line, lineWidth: FeedDesign.Layout.borderWidth)
        )
    }

    private var hashtagPreview: some View {
        FlowLayout(spacing: FeedDesign.Spacing.xs) {
            ForEach(selectedHashtags, id: \.self) { tag in
                HStack(spacing: 4) {
                    Text("#\(tag)")
                        .font(FeedDesign.Typography.caption)
                        .foregroundColor(FeedDesign.Colors.textSecondary)

                    Button {
                        selectedHashtags.removeAll { $0 == tag }
                    } label: {
                        Image(systemName: "xmark")
                            .responsiveFont(.caption2)
                            .foregroundColor(FeedDesign.Colors.textTertiary)
                    }
                }
                .padding(.vertical, 4)
                .padding(.horizontal, FeedDesign.Spacing.xs)
                .overlay(
                    Rectangle()
                        .stroke(FeedDesign.Colors.line, lineWidth: FeedDesign.Layout.borderWidth)
                )
            }
        }
    }

    // MARK: - Bottom Toolbar

    private var bottomToolbar: some View {
        HStack(spacing: FeedDesign.Spacing.xl) {
            // 图片按钮
            toolbarButton(
                icon: "photo",
                isActive: !selectedImages.isEmpty
            ) {
                showImagePicker = true
            }

            // 位置按钮
            toolbarButton(
                icon: "location",
                isActive: selectedLocation != nil
            ) {
                showLocationPicker = true
            }

            // 话题按钮
            toolbarButton(
                icon: "number",
                isActive: !selectedHashtags.isEmpty
            ) {
                showHashtagInput = true
            }

            Spacer()
        }
        .padding(FeedDesign.Spacing.m)
        .overlay(
            Rectangle()
                .frame(height: FeedDesign.Layout.borderWidth)
                .foregroundColor(FeedDesign.Colors.line),
            alignment: .top
        )
    }

    private func toolbarButton(icon: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(isActive ? FeedDesign.Colors.text : FeedDesign.Colors.textTertiary)
                .frame(width: 44, height: 44)
        }
    }

    // MARK: - Navigation Buttons

    private var cancelButton: some View {
        Button {
            dismiss()
        } label: {
            Text(NSLocalizedString("common.cancel", comment: ""))
                .font(FeedDesign.Typography.body)
                .foregroundColor(FeedDesign.Colors.textSecondary)
        }
    }

    private var publishButton: some View {
        Button {
            Task {
                await publishMoment()
            }
        } label: {
            if isPublishing {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle())
            } else {
                Text(NSLocalizedString("feed.create.publish", comment: ""))
                    .font(FeedDesign.Typography.body)
                    .foregroundColor(canPublish ? FeedDesign.Colors.text : FeedDesign.Colors.textTertiary)
            }
        }
        .disabled(!canPublish || isPublishing)
    }

    private var canPublish: Bool {
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Sheets

    private var hashtagInputSheet: some View {
        NavigationView {
            HashtagInputView(selectedHashtags: $selectedHashtags, maxHashtags: 10)
                .navigationTitle(NSLocalizedString("feed.create.add_hashtags", comment: ""))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(NSLocalizedString("common.done", comment: "")) {
                            showHashtagInput = false
                        }
                    }
                }
        }
    }

    private var locationPickerSheet: some View {
        NavigationView {
            FeedLocationPickerView(selectedLocation: $selectedLocation)
                .navigationTitle(NSLocalizedString("feed.create.add_location", comment: ""))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(NSLocalizedString("common.done", comment: "")) {
                            showLocationPicker = false
                        }
                    }
                }
        }
    }

    private var imagePickerSheet: some View {
        ImagePickerView(selectedImages: $selectedImages, maxImages: 9)
    }

    // MARK: - Actions

    private func publishMoment() async {
        guard canPublish else { return }

        isPublishing = true
        defer { isPublishing = false }

        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            // TODO: 上传图片到服务器并获取URL
            var mediaInfo: [FeedService.MediaInfo]? = nil
            if !selectedImages.isEmpty {
                // 暂时跳过图片上传，等待后续实现
                mediaInfo = []
            }

            let response = try await FeedService.shared.createMoment(
                content: trimmedContent,
                hashtags: selectedHashtags.isEmpty ? nil : selectedHashtags,
                location: selectedLocation,
                media: mediaInfo
            )

            if response.success {
                dismiss()
                // TODO: 通知刷新动态流
            } else {
                viewModel.errorMessage = response.message ?? NSLocalizedString("feed.create.error.unknown", comment: "")
                viewModel.showError = true
            }
        } catch {
            viewModel.errorMessage = error.localizedDescription
            viewModel.showError = true
        }
    }
}

// MARK: - ViewModel

@MainActor
class CreateMomentViewModel: ObservableObject {
    @Published var showError = false
    @Published var errorMessage = ""
}

// MARK: - Flow Layout (简易实现)

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(at: result.positions[index], proposal: .unspecified)
        }
    }

    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if x + size.width > maxWidth, x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }

                positions.append(CGPoint(x: x, y: y))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }

            self.size = CGSize(width: maxWidth, height: y + lineHeight)
        }
    }
}
