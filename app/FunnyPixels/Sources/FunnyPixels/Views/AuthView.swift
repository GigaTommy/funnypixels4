import SwiftUI

/// 简化的认证视图
struct AuthView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ZStack(alignment: .topTrailing) {
                // 主内容
                ScrollView {
                    VStack(spacing: 24) {
                        Spacer()
                            .frame(height: 80)

                        // Logo区域
                        VStack(spacing: 16) {
                            Image(systemName: "paintbrush.fill")
                                .font(.system(size: 60))
                                .foregroundColor(.blue)

                            Text("FunnyPixels")
                                .font(.largeTitle)
                                .fontWeight(.bold)

                            Text("创造属于你的像素世界")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.bottom, 40)

                        // 登录/注册切换
                        Picker("模式", selection: $authViewModel.isLoginMode) {
                            Text("登录").tag(true)
                            Text("注册").tag(false)
                        }
                        .pickerStyle(SegmentedPickerStyle())

                        // 表单
                        VStack(spacing: 16) {
                            // 手机号
                            VStack(alignment: .leading, spacing: 8) {
                                Text("手机号码")
                                    .font(.headline)

                                TextField("请输入手机号码", text: $authViewModel.phoneNumber)
                                    #if !os(macOS)
                                    .keyboardType(.phonePad)
                                    .textContentType(.telephoneNumber)
                                    #endif
                                    .padding()
                                    .background(Color(white: 0.9, opacity: 1.0))
                                    .cornerRadius(12)
                            }

                            // 验证码
                            if authViewModel.showVerificationCodeField {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("验证码")
                                        .font(.headline)

                                    HStack {
                                        TextField("请输入验证码", text: $authViewModel.verificationCode)
                                            #if !os(macOS)
                                            .keyboardType(.numberPad)
                                            .textContentType(.oneTimeCode)
                                            #endif
                                            .padding()
                                            .background(Color(white: 0.9, opacity: 1.0))
                                            .cornerRadius(12)

                                        Button("发送验证码") {
                                            Task {
                                                await authViewModel.sendVerificationCode()
                                            }
                                        }
                                        .foregroundColor(.blue)
                                        .disabled(!authViewModel.canResendCode)
                                    }
                                }
                            }

                            // 用户名（注册时）
                            if !authViewModel.isLoginMode {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("用户名")
                                        .font(.headline)

                                    TextField("请输入用户名", text: $authViewModel.username)
                                        #if !os(macOS)
                                        .textContentType(.username)
                                        #endif
                                        .padding()
                                        .background(Color(white: 0.9, opacity: 1.0))
                                        .cornerRadius(12)
                                }
                            }

                            // 提交按钮
                            Button(action: {
                                Task {
                                    if authViewModel.isLoginMode {
                                        await authViewModel.login()
                                    } else {
                                        await authViewModel.register()
                                    }
                                }
                            }) {
                                Text(authViewModel.isLoginMode ? "登录" : "注册")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 50)
                                    .background(authViewModel.canSubmit ? Color.blue : Color.gray)
                                    .cornerRadius(25)
                            }
                            .disabled(!authViewModel.canSubmit)

                            // 游客登录
                            Button("游客登录") {
                                Task {
                                    await authViewModel.loginAsGuest()
                                }
                            }
                            .foregroundColor(.blue)

                            // 错误信息
                            if let errorMessage = authViewModel.errorMessage {
                                Text(errorMessage)
                                    .foregroundColor(.red)
                                    .font(.caption)
                            }

                            Spacer()
                        }
                        .padding(.horizontal, 24)
                    }
                }

                // 关闭按钮（右上角）
                VStack {
                    HStack {
                        Spacer()
                        Button(action: {
                            dismiss()
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 28))
                                .foregroundColor(.secondary)
                                .padding()
                        }
                    }
                    Spacer()
                }
            }
            #if !os(macOS)
            .navigationBarHidden(true)
            #endif
        }
    }
}
