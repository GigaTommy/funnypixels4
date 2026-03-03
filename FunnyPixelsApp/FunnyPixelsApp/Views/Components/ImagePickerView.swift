import SwiftUI
import PhotosUI

/// 图片选择器 - 遵循简约设计原则
struct ImagePickerView: View {
    @Binding var selectedImages: [UIImage]
    let maxImages: Int

    @State private var selectedItems: [PhotosPickerItem] = []
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // 已选图片预览
                if !selectedImages.isEmpty {
                    selectedImagesPreview
                        .overlay(
                            Rectangle()
                                .frame(height: FeedDesign.Layout.borderWidth)
                                .foregroundColor(FeedDesign.Colors.line),
                            alignment: .bottom
                        )
                }

                // 图片选择器
                PhotosPicker(
                    selection: $selectedItems,
                    maxSelectionCount: maxImages,
                    matching: .images
                ) {
                    VStack(spacing: FeedDesign.Spacing.m) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 48))
                            .foregroundColor(FeedDesign.Colors.textTertiary)

                        Text(NSLocalizedString("feed.create.select_images", comment: ""))
                            .font(FeedDesign.Typography.body)
                            .foregroundColor(FeedDesign.Colors.textSecondary)

                        Text(String(format: NSLocalizedString("feed.create.max_images", comment: ""), maxImages))
                            .font(FeedDesign.Typography.caption)
                            .foregroundColor(FeedDesign.Colors.textTertiary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .onChange(of: selectedItems) { _, newItems in
                    Task {
                        await loadImages(from: newItems)
                    }
                }
            }
            .background(FeedDesign.Colors.background)
            .navigationTitle(NSLocalizedString("feed.create.select_images", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(NSLocalizedString("common.done", comment: "")) {
                        dismiss()
                    }
                    .foregroundColor(FeedDesign.Colors.text)
                }
            }
        }
    }

    // MARK: - Selected Images Preview

    private var selectedImagesPreview: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: FeedDesign.Spacing.xs) {
                ForEach(Array(selectedImages.enumerated()), id: \.offset) { index, image in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 100, height: 100)
                            .clipped()

                        // 删除按钮
                        Button {
                            selectedImages.remove(at: index)
                            if index < selectedItems.count {
                                selectedItems.remove(at: index)
                            }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(FeedDesign.Colors.text)
                                .background(Color.white)
                                .clipShape(Circle())
                        }
                        .padding(FeedDesign.Spacing.xs)
                    }
                }
            }
            .padding(FeedDesign.Spacing.m)
        }
        .frame(height: 120)
    }

    // MARK: - Helper Methods

    private func loadImages(from items: [PhotosPickerItem]) async {
        var newImages: [UIImage] = []

        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                newImages.append(image)
            }
        }

        await MainActor.run {
            selectedImages = newImages
        }
    }
}
