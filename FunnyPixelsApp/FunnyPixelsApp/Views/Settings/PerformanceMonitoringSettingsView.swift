//
//  PerformanceMonitoringSettingsView.swift
//  FunnyPixelsApp
//
//  Privacy controls for performance monitoring
//  Complies with Apple App Store privacy requirements
//

import SwiftUI

/// 性能监控隐私设置视图
struct PerformanceMonitoringSettingsView: View {
    @AppStorage("performance_monitoring_enabled") private var isEnabled = false
    @State private var showingInfo = false

    var body: some View {
        Form {
            Section {
                Toggle(isOn: $isEnabled) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Share Performance Data")
                            .font(.system(size: 16, weight: .medium, design: .rounded))

                        Text("Help us improve app stability")
                            .font(.system(size: 13, design: .rounded))
                            .foregroundColor(.secondary)
                    }
                }
                .onChange(of: isEnabled) { oldValue, newValue in
                    if newValue {
                        // Start collecting when enabled
                        MetricsManager.shared.startCollecting()
                        Logger.info("📊 User enabled performance monitoring")
                    } else {
                        // Stop collecting when disabled
                        MetricsManager.shared.stopCollecting()
                        Logger.info("📊 User disabled performance monitoring")
                    }
                }
            } header: {
                Text("Analytics")
            } footer: {
                VStack(alignment: .leading, spacing: 12) {
                    Text("We collect anonymous performance data to:")
                        .font(.system(size: 13, design: .rounded))
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: 6) {
                        Label("Improve app stability", systemImage: "checkmark.circle.fill")
                        Label("Reduce crashes and bugs", systemImage: "checkmark.circle.fill")
                        Label("Optimize startup time", systemImage: "checkmark.circle.fill")
                    }
                    .font(.system(size: 13, design: .rounded))
                    .foregroundColor(.secondary)
                }
                .padding(.top, 4)
            }

            Section {
                Button {
                    showingInfo = true
                } label: {
                    HStack {
                        Image(systemName: "info.circle")
                        Text("What data do we collect?")
                            .font(.system(size: 15, design: .rounded))
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                    }
                }

                Link(destination: URL(string: AppConfig.privacyPolicyURL)!) {
                    HStack {
                        Image(systemName: "doc.text")
                        Text("Privacy Policy")
                            .font(.system(size: 15, design: .rounded))
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Performance Monitoring")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingInfo) {
            DataCollectionInfoSheet()
        }
        .onAppear {
            // Initialize MetricKit if enabled
            if isEnabled {
                MetricsManager.shared.startCollecting()
            }
        }
    }
}

/// 数据收集说明弹窗
struct DataCollectionInfoSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // What we collect
                    VStack(alignment: .leading, spacing: 12) {
                        Label("What We Collect", systemImage: "checkmark.shield.fill")
                            .font(.system(size: 18, weight: .semibold, design: .rounded))
                            .foregroundColor(AppColors.primary)

                        VStack(alignment: .leading, spacing: 8) {
                            PerformanceInfoRow(icon: "stopwatch", title: "Performance Metrics", description: "App startup time, screen loading time, memory usage")
                            PerformanceInfoRow(icon: "exclamationmark.triangle", title: "Crash Reports", description: "Anonymous crash logs to help us fix bugs")
                            PerformanceInfoRow(icon: "iphone", title: "Device Information", description: "Device model (e.g., iPhone 14,2), iOS version")
                            PerformanceInfoRow(icon: "wifi", title: "Network Performance", description: "API response times, network errors")
                        }
                    }

                    Divider()

                    // What we DON'T collect
                    VStack(alignment: .leading, spacing: 12) {
                        Label("What We DON'T Collect", systemImage: "shield.lefthalf.filled")
                            .font(.system(size: 18, weight: .semibold, design: .rounded))
                            .foregroundColor(.green)

                        VStack(alignment: .leading, spacing: 8) {
                            PerformanceInfoRow(icon: "person.crop.circle.badge.xmark", title: "Personal Information", description: "No user IDs, names, or email addresses")
                            PerformanceInfoRow(icon: "location.slash", title: "Location Data", description: "GPS coordinates are never included")
                            PerformanceInfoRow(icon: "phone.connection.slash", title: "Device Identifiers", description: "No IDFA, IDFV, or tracking IDs")
                            PerformanceInfoRow(icon: "text.badge.xmark", title: "User Content", description: "No messages, drawings, or personal data")
                        }
                    }

                    Divider()

                    // Privacy guarantees
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Privacy Guarantees", systemImage: "lock.shield.fill")
                            .font(.system(size: 18, weight: .semibold, design: .rounded))
                            .foregroundColor(.orange)

                        VStack(alignment: .leading, spacing: 8) {
                            PerformanceInfoRow(icon: "eye.slash", title: "Anonymous", description: "All data is completely anonymous")
                            PerformanceInfoRow(icon: "lock.fill", title: "Encrypted", description: "Data is encrypted during transmission")
                            PerformanceInfoRow(icon: "wifi.circle.fill", title: "WiFi Only", description: "Only uploads on WiFi to save data")
                            PerformanceInfoRow(icon: "xmark.circle.fill", title: "Opt-Out Anytime", description: "You can disable this at any time")
                        }
                    }

                    Divider()

                    // Apple compliance
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Apple Approved", systemImage: "apple.logo")
                            .font(.system(size: 16, weight: .medium, design: .rounded))
                            .foregroundColor(.secondary)

                        Text("We use Apple's official MetricKit framework, which is designed with privacy in mind and approved by Apple for App Store apps.")
                            .font(.system(size: 14, design: .rounded))
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
            }
            .navigationTitle("Data Collection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Text("Done")
                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                    }
                }
            }
        }
    }
}

/// 信息行组件
struct PerformanceInfoRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(AppColors.primary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .medium, design: .rounded))

                Text(description)
                    .font(.system(size: 13, design: .rounded))
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    NavigationView {
        PerformanceMonitoringSettingsView()
    }
}
