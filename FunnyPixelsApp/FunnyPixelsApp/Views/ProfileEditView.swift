import SwiftUI

struct ProfileEditView: View {
    @ObservedObject var viewModel: ProfileViewModel
    @ObservedObject private var fontManager = FontSizeManager.shared
    @Environment(\.dismiss) var dismiss
    @State private var showAvatarEditor = false
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Spacer()
                        ZStack(alignment: .bottomTrailing) {
                            // 优先显示编辑中的像素数据预览，否则显示当前CDN头像
                            if let avatarData = viewModel.editAvatarData, avatarData.contains(",") {
                                // 编辑中的新头像（像素数据）
                                PixelAvatarView(pixelData: avatarData, size: 80)
                                    .frame(width: 80, height: 80)
                                    .clipShape(Circle())
                            } else if let avatarUrl = viewModel.userProfile?.avatarUrl, !avatarUrl.isEmpty {
                                // 当前头像（CDN图片）
                                AvatarView(
                                    avatarUrl: avatarUrl,
                                    displayName: viewModel.userProfile?.displayOrUsername ?? "",
                                    size: 80
                                )
                            } else {
                                // 无头像占位符
                                Circle()
                                    .fill(AppColors.border)
                                    .frame(width: 80, height: 80)
                                    .overlay(
                                        Text(viewModel.userProfile?.displayOrUsername.prefix(1).uppercased() ?? "U")
                                            .font(.system(size: 32, weight: .semibold))
                                            .foregroundColor(.white)
                                    )
                            }

                            Image(systemName: "camera.fill")
                                .padding(6)
                                .background(Circle().fill(AppColors.primary))
                                .foregroundColor(.white)
                                .font(AppTypography.caption())
                        }
                        .onTapGesture {
                            showAvatarEditor = true
                        }
                        Spacer()
                    }
                    .padding(.vertical, AppSpacing.s)
                }
                
                Section(header: Text(NSLocalizedString("profile.edit.info", comment: ""))) {
                    TextField(NSLocalizedString("profile.edit.nickname", comment: ""), text: $viewModel.editDisplayName)
                        .font(AppTypography.body())
                    TextField(NSLocalizedString("profile.edit.motto", comment: ""), text: $viewModel.editMotto)
                        .font(AppTypography.body())
                }
                
                Section {
                    Button(NSLocalizedString("profile.edit.save", comment: "")) {
                        Task {
                            await viewModel.saveProfile()
                            if viewModel.errorMessage == nil {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isLoading)
                    .font(AppTypography.body())
                    .foregroundColor(viewModel.isLoading ? AppColors.textSecondary : AppColors.primary)
                }
            }
            .navigationTitle(NSLocalizedString("profile.edit.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("profile.edit.cancel", comment: "")) {
                        viewModel.cancelEditing()
                        dismiss()
                    }
                }
                
                if viewModel.isLoading {
                    ToolbarItem(placement: .primaryAction) {
                        ProgressView()
                    }
                }
            }
            .alert("提示", isPresented: Binding<Bool>(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") {}
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
            .fullScreenCover(isPresented: $showAvatarEditor) {
                AvatarEditor(
                    isPresented: $showAvatarEditor,
                    avatarData: $viewModel.editAvatarData,
                    initialAvatarData: viewModel.userProfile?.avatar,
                    avatarUrl: viewModel.userProfile?.avatarUrl,
                    displayName: viewModel.userProfile?.displayOrUsername ?? "User"
                ) { newData in
                    viewModel.editAvatarData = newData
                }
            }
        }
    }
}
