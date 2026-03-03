import SwiftUI
import Combine

/// 联盟Tab视图
struct AllianceTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = AllianceViewModel()
    @State private var showCreateAlliance = false
    @State private var showSearch = false
    @State private var showEditAlliance = false
    @State private var showEditNotice = false
    @State private var noticeText = ""
    @State private var showDissolveConfirmation = false
    @State private var showLeaveConfirmation = false
    @Namespace private var namespace

    var body: some View {
        NavigationStack {
            mainContentView
                .navigationTitle(NSLocalizedString("alliance.title", comment: "Alliance"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if authViewModel.isAuthenticated {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(action: {
                                showCreateAlliance = true
                            }) {
                                Image(systemName: "plus")
                            }
                        }
                    }
                }
                .sheet(isPresented: $showCreateAlliance) {
                    CreateAllianceView(onSuccess: {
                        viewModel.loadUserAlliance(force: true)
                    })
                    .environmentObject(viewModel)
                }
                .sheet(isPresented: $showEditAlliance) {
                    AllianceEditView(viewModel: viewModel)
                }
                .toast(isPresented: Binding(
                    get: { viewModel.successMessage != nil },
                    set: { if !$0 { viewModel.successMessage = nil } }
                ), message: viewModel.successMessage ?? "", style: .success)
                .alert(NSLocalizedString("common.error", comment: "Error"), isPresented: Binding(
                    get: { viewModel.errorMessage != nil },
                    set: { val in
                        if !val {
                            DispatchQueue.main.async {
                                viewModel.errorMessage = nil
                            }
                        }
                    }
                )) {
                    Button(NSLocalizedString("common.confirm", comment: "OK"), role: .cancel) {}
                } message: {
                    if let msg = viewModel.errorMessage {
                        Text(msg)
                    }
                }
                .alert(NSLocalizedString("alliance.invite.title", comment: "Invite Code"), isPresented: $viewModel.showInviteCode) {
                    Button(NSLocalizedString("alliance.invite.copy", comment: "Copy"), action: {
                        UIPasteboard.general.string = viewModel.inviteCode
                    })
                    Button(NSLocalizedString("common.confirm", comment: "OK"), role: .cancel) {}
                } message: {
                    Text(String(format: NSLocalizedString("alliance.invite.message", comment: "Invite Message"), viewModel.inviteCode))
                }
                .alert(NSLocalizedString("alliance.dissolve.title", comment: "Dissolve Alliance"), isPresented: $showDissolveConfirmation) {
                    Button(NSLocalizedString("common.cancel", comment: "Cancel"), role: .cancel) {}
                    Button(NSLocalizedString("common.confirm", comment: "Confirm"), role: .destructive) {
                        Task { await viewModel.dissolveAlliance(allianceId: viewModel.userAlliance?.id ?? 0) }
                    }
                } message: {
                    Text(NSLocalizedString("alliance.dissolve.message", comment: "Are you sure you want to dissolve? This cannot be undone."))
                }
                .alert(NSLocalizedString("alliance.leave.title", comment: "Leave Alliance"), isPresented: $showLeaveConfirmation) {
                    Button(NSLocalizedString("common.cancel", comment: "Cancel"), role: .cancel) {}
                    Button(NSLocalizedString("common.confirm", comment: "Confirm"), role: .destructive) {
                        Task { await viewModel.leaveAlliance(allianceId: viewModel.userAlliance?.id ?? 0) }
                    }
                } message: {
                    Text(NSLocalizedString("alliance.leave.message", comment: "Are you sure you want to leave this alliance?"))
                }
                .onAppear {
                    viewModel.loadUserAlliance()
                }
                .refreshable {
                    viewModel.loadUserAlliance(force: true)
                }
        }
    }

    private var mainContentView: some View {
        VStack(spacing: 0) {
            // Sub-Tab选择器
            CapsuleTabPicker(items: AllianceSubTab.allCases, selection: $appState.allianceSubTab)

            // 内容区域
            ScrollView {
                VStack(spacing: AppSpacing.l) {
                    if !authViewModel.isAuthenticated {
                        guestAlliancePrompt
                    } else if appState.allianceSubTab == .myAlliance {
                        myAllianceSection
                    } else {
                        searchAllianceSection
                    }
                }
                .padding()
            }
        }
        .background(AppColors.background)
        .onChange(of: appState.allianceSubTab) { oldValue, newValue in
            // 切换到发现Tab时加载联盟列表
            if newValue == .discover && viewModel.searchResults.isEmpty && viewModel.searchQuery.isEmpty {
                Task {
                    await viewModel.searchAlliances()
                }
            }
        }
    }


    private var myAllianceSection: some View {
        Group {
            if viewModel.isLoadingAlliance {
                LoadingView()
                    .padding(.top, 50)
            } else if !viewModel.userAlliances.isEmpty {
                VStack(spacing: 16) {
                    ForEach(viewModel.userAlliances) { alliance in
                        NavigationLink(destination: AllianceDetailPage(alliance: alliance, viewModel: viewModel)) {
                            AllianceListRow(alliance: alliance)
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                emptyStateView
                    .padding(.top, 40)
            }
        }
    }
    
    private func roleDisplayName(_ role: String) -> String {
        switch role {
        case "leader": return NSLocalizedString("alliance.role.leader", comment: "Leader")
        case "admin": return NSLocalizedString("alliance.role.admin", comment: "Admin")
        case "member": return NSLocalizedString("alliance.role.member", comment: "Member")
        default: return role
        }
    }
    
    private func roleColor(_ role: String) -> Color {
        switch role {
        case "leader": return .red
        case "admin": return .blue
        default: return .gray
        }
    }
    
    private func allianceColor(for alliance: AllianceService.Alliance) -> Color {
        if let colorHex = alliance.color {
            return Color(hex: colorHex) ?? .blue
        }
        return .blue
    }

    private var searchAllianceSection: some View {
        VStack(spacing: 16) {
            // 搜索栏
            // 搜索栏
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(AppColors.textSecondary)
                    .font(.system(size: 16, weight: .medium))

                TextField(NSLocalizedString("alliance.search.placeholder", comment: ""), text: $viewModel.searchQuery)
                    .textFieldStyle(.plain) // Standard style inside custom container
                    .font(.system(size: 16))
                    .onSubmit {
                        Task {
                            await viewModel.searchAlliances()
                        }
                    }

                if !viewModel.searchQuery.isEmpty {
                    Button(action: {
                        viewModel.searchQuery = ""
                        viewModel.searchResults = []
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(AppColors.textTertiary)
                            .font(.system(size: 16))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            // Use lighter gray and more rounded corners
            .background(AppColors.surface) 
            .cornerRadius(AppRadius.l) // 16 or 20
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.l)
                    .stroke(AppColors.primary.opacity(0.1), lineWidth: 1)
            )
            .shadow(color: AppColors.primary.opacity(0.03), radius: 5, x: 0, y: 2)

            // 搜索结果
            if viewModel.isSearching {
                ProgressView(NSLocalizedString("alliance.search.searching", comment: ""))
            } else if viewModel.searchResults.isEmpty && !viewModel.searchQuery.isEmpty {
                Text(NSLocalizedString("alliance.search.no_results", comment: ""))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else if !viewModel.searchResults.isEmpty {
                VStack(spacing: 12) {
                    if viewModel.searchQuery.isEmpty {
                        HStack {
                            Text(NSLocalizedString("alliance.search.popular", comment: "Popular Alliances"))
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                            Spacer()
                        }
                        .padding(.horizontal, 4)
                        .padding(.top, 4)
                    }

                    ForEach(viewModel.searchResults) { alliance in
                        AllianceSearchResultCard(alliance: alliance) {
                            Task {
                                await viewModel.applyToAlliance(alliance.id)
                            }
                        }
                        .onAppear {
                            if alliance.id == viewModel.searchResults.last?.id {
                                viewModel.loadMoreAlliances()
                            }
                        }
                    }

                    if viewModel.isLoadingMore {
                        ProgressView()
                            .padding()
                    }
                }
            } else {
                Text(NSLocalizedString("alliance.search.placeholder", comment: ""))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            }
        }
    }

    private var guestAlliancePrompt: some View {
        VStack(spacing: AppSpacing.xl) {
            Image(systemName: "flag.2.crossed.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.primary.opacity(0.8))
                .padding(.top, 40)

            VStack(spacing: AppSpacing.m) {
                Text(NSLocalizedString("alliance.guest.title", comment: ""))
                    .font(AppTypography.title3())
                    .foregroundColor(AppColors.textPrimary)

                Text(NSLocalizedString("alliance.guest.message", comment: ""))
                    .font(AppTypography.subheadline())
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            StandardButton(
                title: NSLocalizedString("history.login_register", comment: ""),
                style: .primary,
                size: .large
            ) {
                NotificationCenter.default.post(name: NSNotification.Name("ShowAuthSheet"), object: nil)
            }
            .padding(.horizontal, 40)

            Spacer()
        }
        .padding(.top, 20)
    }

    private var emptyStateView: some View {
        EmptyStateView(
            title: NSLocalizedString("alliance.empty.title", comment: ""),
            message: NSLocalizedString("alliance.empty.message", comment: ""),
            systemImage: "person.3.fill",
            actionTitle: NSLocalizedString("alliance.create", comment: ""),
            action: { showCreateAlliance = true }
        )
    }
}

/// 功能菜单行
struct AllianceMenuRow: View {
    let icon: String
    let title: String
    let subtitle: String
    var badge: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        Group {
            if let action = action {
                Button(action: action) {
                    rowContent
                }
                .buttonStyle(.plain)
            } else {
                rowContent
            }
        }
    }
    
    private var rowContent: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold)) // Slightly bigger, semibold
                .foregroundColor(AppColors.primary)
                .frame(width: 24) // Fixed width for alignment
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppTypography.body())
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.textPrimary)
                
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }
            }
            
            Spacer()
            
            if let badge = badge {
                Text(badge)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.red)
                    .clipShape(Capsule())
            }
            
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(AppColors.textTertiary.opacity(0.5))
        }
        .padding(16)
        .contentShape(Rectangle())
        // Removed explicit background/cornerRadius here as it's usually inside a container, 
        // but if it's standalone, let's coordinate.
        // Looking at usage: It's inside AllianceMenuListView which HAS background.
        // So keeping it transparent is correct.
    }
}

/// 搜索结果卡片
struct AllianceSearchResultCard: View {
    let alliance: AllianceService.Alliance
    let onJoin: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(allianceColor.opacity(0.1))
                        .frame(width: 40, height: 40) // 44 -> 40

                    if let renderType = alliance.flagRenderType,
                       let unicodeChar = alliance.flagUnicodeChar,
                       (renderType == "emoji" || renderType == "color") {
                        Text(unicodeChar)
                            .font(.system(size: 20)) // 22 -> 20
                    } else if let renderType = alliance.flagRenderType,
                              renderType == "complex" {
                        if let payload = alliance.flagPayload,
                           let data = Data(base64Encoded: payload.replacingOccurrences(of: "data:image/png;base64,", with: "")),
                           let uiImage = UIImage(data: data) {
                             Image(uiImage: uiImage)
                                 .resizable()
                                 .aspectRatio(contentMode: .fit)
                                 .frame(width: 28, height: 28)
                        } else if let url = alliance.flagSpriteURL {
                             CachedAsyncImagePhase(url: url) { phase in
                                 switch phase {
                                 case .success(let image):
                                     image
                                         .resizable()
                                         .aspectRatio(contentMode: .fit)
                                         .frame(width: 28, height: 28)
                                 case .failure:
                                     Image(systemName: "flag.fill")
                                         .font(.system(size: 16))
                                         .foregroundColor(allianceColor)
                                 case .empty:
                                     ProgressView().scaleEffect(0.5)
                                 @unknown default:
                                     EmptyView()
                                 }
                             }
                        } else {
                            Image(systemName: "flag.fill")
                                .font(.system(size: 16))
                                .foregroundColor(allianceColor)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(alliance.name)
                        .font(.headline) // 15, bold -> .headline
                        .foregroundColor(Color(uiColor: .darkGray)) // Dark Gray Title

                    Text("\(alliance.memberCount)/\(alliance.maxMembers) " + NSLocalizedString("alliance.members", comment: ""))
                        .font(.caption) // 11 -> .caption
                        .foregroundColor(.secondary)
                }

                Spacer()

                Button(action: {
                    HapticManager.shared.impact(style: .light)
                    onJoin()
                }) {
                    Text(alliance.approvalRequired ? NSLocalizedString("alliance.btn.apply", comment: "") : NSLocalizedString("alliance.btn.join", comment: ""))
                        .font(.system(size: 13, weight: .bold)) // Slightly increased
                        .foregroundColor(.white)
                        .padding(.horizontal, 16) // Wider button
                        .padding(.vertical, 8) // Taller button
                        .background(
                            LinearGradient(colors: [AppColors.primary, AppColors.primary.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                        .cornerRadius(20)
                        .shadow(color: AppColors.primary.opacity(0.3), radius: 4, x: 0, y: 2)
                }
            }

            if let description = alliance.description {
                Text(description)
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textSecondary)
                    .lineLimit(2)
                    .padding(.top, 4) // Spacing
            }
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .cornerRadius(AppRadius.xl)
        .modifier(AppShadows.medium())
    }

    private var allianceColor: Color {
        if let colorHex = alliance.color {
            return Color(hex: colorHex) ?? .blue
        }
        return .blue
    }
}

/// 创建联盟视图
struct CreateAllianceView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var allianceViewModel: AllianceViewModel
    @StateObject private var viewModel = CreateAllianceViewModel()
    
    private var limitInfo: (current: Int, max: Int, canCreate: Bool) {
        let pixels = authViewModel.currentUser?.totalPixels ?? 0
        let extra = pixels / 200
        let maxLimit = min(5, 1 + extra)
        let current = allianceViewModel.userAlliances.filter { $0.userRole == "leader" }.count
        return (current, maxLimit, current < maxLimit)
    }
    var onSuccess: (() -> Void)?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text(NSLocalizedString("alliance.limit.usage", comment: "Created"))
                        Spacer()
                        Text("\(limitInfo.current)/\(limitInfo.max)")
                            .foregroundColor(limitInfo.canCreate ? .primary : .red)
                    }
                    
                    if !limitInfo.canCreate {
                        if limitInfo.max < 5 {
                            let pixels = authViewModel.currentUser?.totalPixels ?? 0
                            let needed = 200 - (pixels % 200)
                            Text(String(format: NSLocalizedString("alliance.limit.needed", comment: ""), needed))
                                .font(.caption)
                                .foregroundColor(.orange)
                        } else {
                            Text(NSLocalizedString("alliance.limit.max", comment: ""))
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                } header: {
                    Text(NSLocalizedString("alliance.limit.title", comment: "Limit"))
                }

                Section {
                    HStack(spacing: 20) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.blue.opacity(0.1))
                                .frame(width: 64, height: 64)
                            
                            if let pattern = viewModel.selectedPattern {
                                if pattern.renderType == "color", let colorHex = pattern.color {
                                    Circle()
                                        .fill(Color(hex: colorHex) ?? .blue)
                                        .frame(width: 44, height: 44)
                                } else if pattern.renderType == "emoji", let unicode = pattern.unicodeChar {
                                    Text(unicode)
                                        .font(.system(size: 32))
                            } else if pattern.renderType == "complex" {
                                if let payload = pattern.payload,
                                   let data = Data(base64Encoded: payload.replacingOccurrences(of: "data:image/png;base64,", with: "")),
                                   let uiImage = UIImage(data: data) {
                                    Image(uiImage: uiImage)
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                        .frame(width: 44, height: 44)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                } else if let url = pattern.spriteURL {
                                    CachedAsyncImagePhase(url: url) { phase in
                                        switch phase {
                                        case .success(let image):
                                            image
                                                .resizable()
                                                .aspectRatio(contentMode: .fit)
                                                .frame(width: 44, height: 44)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                        case .failure:
                                            Image(systemName: "flag.fill")
                                                .font(.title)
                                                .foregroundColor(.blue)
                                        case .empty:
                                            ProgressView().scaleEffect(0.5)
                                        @unknown default:
                                            EmptyView()
                                        }
                                    }
                                } else {
                                    Image(systemName: "flag.fill")
                                        .font(.title)
                                        .foregroundColor(.blue)
                                }
                            } else {
                                Image(systemName: "flag.fill")
                                    .font(.title)
                                    .foregroundColor(.blue)
                            }
                        }
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            TextField(NSLocalizedString("alliance.form.name", comment: ""), text: $viewModel.allianceName)
                                .font(.headline)
                            
                            Text(viewModel.selectedPatternName)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 8)

                    TextField(NSLocalizedString("alliance.form.desc", comment: ""), text: $viewModel.allianceDescription, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(3...6)
                } header: {
                    Text(NSLocalizedString("alliance.form.basic", comment: ""))
                }

                Section {
                    Picker(NSLocalizedString("alliance.form.visibility", comment: ""), selection: $viewModel.isPublic) {
                        Text(NSLocalizedString("alliance.form.public", comment: "")).tag(true)
                        Text(NSLocalizedString("alliance.form.private", comment: "")).tag(false)
                    }
                    .pickerStyle(.segmented)

                    Toggle(NSLocalizedString("alliance.form.approval", comment: ""), isOn: $viewModel.approvalRequired)
                } header: {
                    Text(NSLocalizedString("alliance.form.settings", comment: ""))
                }

                Section {
                    NavigationLink {
                        FlagPatternSelectorView(selectedPatternId: $viewModel.flagPatternId)
                    } label: {
                        HStack {
                            Text(NSLocalizedString("alliance.form.flag", comment: ""))
                            Spacer()
                            Text(viewModel.selectedPatternName)
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text(NSLocalizedString("alliance.form.pattern", comment: ""))
                }
            }
            .navigationTitle(NSLocalizedString("alliance.create", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.cancel", comment: "")) {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(NSLocalizedString("alliance.btn.create_action", comment: "")) {
                        Task {
                            await viewModel.createAlliance(onSuccess: onSuccess)
                            if viewModel.isSuccess {
                                dismiss()
                            }
                        }
                    }
                    .disabled(!viewModel.isValid || viewModel.isCreating || !limitInfo.canCreate)
                }
            }
            .toast(isPresented: $viewModel.showSuccessAlert, message: viewModel.successMessage, style: .success)
            .alert(NSLocalizedString("common.error", comment: ""), isPresented: $viewModel.showError) {
                Button(NSLocalizedString("common.confirm", comment: "")) {}
            } message: {
                Text(viewModel.errorMessage)
            }
        }
        .onAppear {
            viewModel.loadFlagPatterns()
        }
    }
}

/// 旗帜图案选择器
struct FlagPatternSelectorView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var selectedPatternId: String
    var onSelection: ((String, String) -> Void)? = nil
    @StateObject private var viewModel = FlagPatternViewModel()
    @State private var showDisclaimer = false

    var body: some View {
        VStack(spacing: 0) {
            // 分类选择器
            Picker(NSLocalizedString("alliance.flag.type", comment: ""), selection: $viewModel.selectedCategory) {
                Text(NSLocalizedString("alliance.flag.color", comment: "")).tag("color")
                Text(NSLocalizedString("alliance.flag.emoji", comment: "")).tag("emoji")
                Text(NSLocalizedString("alliance.flag.complex", comment: "")).tag("complex")
            }
            .pickerStyle(.segmented)
            .padding()

            Divider()

            // 旗帜网格列表
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))], spacing: 16) {
                    currentPatternsView
                }
                .padding()
            }
        }
        .navigationTitle(NSLocalizedString("alliance.flag.select", comment: ""))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    showDisclaimer = true
                } label: {
                    Image(systemName: "info.circle")
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(NSLocalizedString("common.confirm", comment: "")) {
                    if let selected = viewModel.selectedPattern {
                        // 优先使用 key (custom_xxx, emoji_xxx, color_xxx)
                        // 若無 key，则使用 patternId (某些旧数据)
                        // 最后使用 ID (String)
                        let finalId = selected.key ?? selected.patternId ?? String(selected.id)

                        selectedPatternId = finalId
                        onSelection?(finalId, selected.name)
                    }
                    dismiss()
                }
                .disabled(viewModel.selectedPattern == nil)
            }
        }
        .alert(NSLocalizedString("disclaimer.title", comment: ""), isPresented: $showDisclaimer) {
            Button(NSLocalizedString("common.confirm", comment: ""), role: .cancel) { }
        } message: {
            Text(NSLocalizedString("disclaimer.flag", comment: ""))
        }
        .onAppear {
            Task {
                await viewModel.loadPatterns()
            }
        }
        .onChange(of: viewModel.flagPatterns) { oldValue, newValue in
            // 当旗帜图案数据加载完成后，如果有已选中的 patternId，设置选中状态
            if !selectedPatternId.isEmpty {
                let allPatterns = newValue.colors + newValue.emojis + newValue.complex
                // 尝试匹配 patternId 或 key
                if let pattern = allPatterns.first(where: { 
                    $0.patternId == selectedPatternId || 
                    $0.key == selectedPatternId ||
                    String($0.id) == selectedPatternId
                }) {
                    viewModel.selectedPattern = pattern
                    // 根据选中的图案设置正确的分类
                    if pattern.renderType == "color" {
                        viewModel.selectedCategory = "color"
                    } else if pattern.renderType == "emoji" {
                        viewModel.selectedCategory = "emoji"
                    } else {
                        viewModel.selectedCategory = "complex"
                    }
                }
            }
        }
        .onChange(of: viewModel.selectedCategory) { oldValue, newValue in
            // 切换分类时清除选中状态，或者检查当前选中图案是否属于新分类
            if let current = viewModel.selectedPattern {
                let belongsToNewCategory = (newValue == "color" && current.renderType == "color") ||
                                          (newValue == "emoji" && current.renderType == "emoji") ||
                                          (newValue == "complex" && current.renderType != "color" && current.renderType != "emoji")
                if !belongsToNewCategory {
                    viewModel.selectedPattern = nil
                }
            }
        }
    }

    // 根据当前分类返回对应的旗帜列表视图
    @ViewBuilder
    private var currentPatternsView: some View {
        Group {
            if viewModel.selectedCategory == "color" {
                patternGridContent(patterns: viewModel.flagPatterns.colors)
            } else if viewModel.selectedCategory == "emoji" {
                patternGridContent(patterns: viewModel.flagPatterns.emojis)
            } else {
                patternGridContent(patterns: viewModel.flagPatterns.complex)
            }
        }
    }

    // 旗帜网格内容
    @ViewBuilder
    private func patternGridContent(patterns: [AllianceService.FlagPattern]) -> some View {
        if patterns.isEmpty {
            Text(NSLocalizedString("alliance.flag.empty", comment: "No patterns"))
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.top, 50)
        } else {
            ForEach(patterns) { pattern in
                PatternGridItem(
                    pattern: pattern,
                    isSelected: viewModel.selectedPattern?.id == pattern.id,
                    onTap: { viewModel.selectedPattern = pattern }
                )
            }
        }
    }
}

/// 单个旗帜网格项
struct PatternGridItem: View {
    let pattern: AllianceService.FlagPattern
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                // 旗帜预览
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.blue.opacity(0.1))
                        .frame(width: 60, height: 60)

                    if pattern.renderType == "color", let colorHex = pattern.color {
                        Circle()
                            .fill(Color(hex: colorHex) ?? .blue)
                            .frame(width: 50, height: 50)
                    } else if pattern.renderType == "emoji", let unicode = pattern.unicodeChar {
                        Text(unicode)
                            .font(.title)
                    } else if pattern.renderType == "complex" {
                        // For complex patterns, we rely on the backend to serve the correct image via /api/sprites/icon
                        // The pattern is identified by its pattern_id or key
                        if let url = pattern.spriteURL {
                            CachedAsyncImagePhase(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                        .padding(8)
                                case .failure:
                                    Image(systemName: "flag.fill")
                                        .foregroundColor(.red)
                                        .font(.title)
                                        .opacity(0.5)
                                case .empty:
                                    ProgressView()
                                        .scaleEffect(0.5)
                                @unknown default:
                                    EmptyView()
                                }
                            }
                        } else {
                            Text("🚩")
                                .font(.title)
                                .opacity(0.3)
                        }
                    } else {
                        Image(systemName: "square.grid.3x3.fill")
                            .font(.title)
                            .foregroundColor(.blue)
                    }

                    // 选中标记
                    if isSelected {
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.blue, lineWidth: 3)
                            .frame(width: 60, height: 60)
                    }
                }

                // 旗帜名称
                Text(pattern.name)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                
                // 价格信息已隐藏 (User Request: 屏蔽 common.free/gold 文字)
            }
        }
        .buttonStyle(.plain)
        .disabled(!pattern.isOwned && !pattern.isFree)
        .opacity((!pattern.isOwned && !pattern.isFree) ? 0.5 : 1)
    }
}

/// 联盟ViewModel
@MainActor
class AllianceViewModel: ObservableObject {
    @Published var userAlliance: AllianceService.Alliance?
    @Published var userAlliances: [AllianceService.Alliance] = [] // 🆕 Support multiple alliances
    @Published var allianceStats: AllianceService.AllianceStats?
    @Published var isLoading = false
    // Per-domain loading flags
    @Published var isLoadingAlliance = false
    @Published var isLoadingMembers = false
    @Published var isLoadingApplications = false
    @Published var isLoadingStats = false
    // Per-domain errors
    @Published var membersError: String?
    @Published var applicationsError: String?
    @Published var statsError: String?
    @Published var searchQuery = ""
    @Published var searchResults: [AllianceService.Alliance] = []
    @Published var isSearching = false
    @Published var pendingApplications = 0
    @Published var errorMessage: String?
    @Published var showInviteCode = false
    @Published var inviteCode = ""
    @Published var members: [AllianceService.AllianceMember] = []
    @Published var applications: [AllianceService.AllianceApplication] = []
    @Published var successMessage: String?
    @Published var isActionLoading = false

    // Pagination properties
    @Published var hasMoreResults = true
    @Published var isLoadingMore = false
    private var currentOffset = 0
    private let limit = 20
    
    // Combine cancellables
    private var allianceUpdateCancellable: AnyCancellable?
    private var searchDebounceCancellable: AnyCancellable?

    private let allianceService = AllianceService.shared

    /// 数据缓存：避免频繁切换 Tab 时重复请求（60秒内复用缓存）
    private var lastLoadTime: Date?
    private let cacheValidDuration: TimeInterval = 60

    init() {
        // Search debounce: auto-search after user stops typing
        searchDebounceCancellable = $searchQuery
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] query in
                guard let self = self else { return }
                Task {
                    await self.searchAlliances()
                }
            }

        // Subscribe to alliance updates from Socket.IO
        Task {
            allianceUpdateCancellable = await SocketIOManager.shared.allianceUpdatedPublisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] updateData in
                    guard let self = self else { return }
                    
                    // Extract alliance ID from the update
                    if let allianceId = updateData["allianceId"] as? Int,
                       let currentAllianceId = self.userAlliance?.id,
                       allianceId == currentAllianceId {
                        
                        Logger.info("🔄 收到联盟更新通知，重新加载联盟数据")
                        
                        // Reload alliance data
                        Task {
                            await MainActor.run {
                                self.loadUserAlliance(force: true)
                            }
                        }
                    }
                }
        }
    }

    func loadUserAlliance(force: Bool = false) {
        Task {
            // 缓存检查：60秒内不重复请求
            if !force, let lastLoad = lastLoadTime,
               Date().timeIntervalSince(lastLoad) < cacheValidDuration {
                return
            }
            isLoadingAlliance = true
            defer { isLoadingAlliance = false }

            do {
                // 🆕 Fetch all alliances
                let alliances = try await allianceService.fetchUserAlliances()
                userAlliances = alliances
                
                // Keep the first one as primary for checking status, or nil if empty
                if let firstAlliance = alliances.first {
                    userAlliance = firstAlliance
                    
                    // 加载联盟统计 (Update: Might need to handle stats for multiple alliances later)
                    // Currently just loading stats for the first one to keep existing UI working
                    let stats = try await allianceService.getAllianceStats(id: firstAlliance.id)
                    allianceStats = stats

                    // 如果是管理员，加载申请数量 (Check role in ANY alliance? Or just the primary?)
                    // For now, check the primary one
                    if firstAlliance.userRole == "leader" || firstAlliance.userRole == "admin" {
                        await loadApplications()
                    }
                    
                    // 加载成员列表
                    await loadMembers()
                } else {
                    userAlliance = nil
                    allianceStats = nil
                }
                lastLoadTime = Date()
            } catch {
                errorMessage = error.localizedDescription
                Logger.error("Failed to load user alliances: \(error)")
            }
        }
    }

    func loadMembers() async {
        guard let alliance = userAlliance else { return }
        await loadMembers(for: alliance.id)
    }

    func loadMembers(for allianceId: Int) async {
        isLoadingMembers = true
        membersError = nil
        defer { isLoadingMembers = false }
        do {
            members = try await allianceService.getAllianceMembers(id: allianceId)
        } catch {
            membersError = error.localizedDescription
            Logger.error("Failed to load members: \(error)")
        }
    }

    func loadApplications() async {
        guard let alliance = userAlliance else { return }
        await loadApplications(for: alliance.id)
    }

    func loadApplications(for allianceId: Int) async {
        isLoadingApplications = true
        applicationsError = nil
        defer { isLoadingApplications = false }
        do {
            applications = try await allianceService.getAllianceApplications(id: allianceId)
            pendingApplications = applications.filter { $0.status == "pending" }.count
        } catch {
            applicationsError = error.localizedDescription
            Logger.error("Failed to load applications: \(error)")
        }
    }

    func loadStats(for allianceId: Int) async {
        isLoadingStats = true
        statsError = nil
        defer { isLoadingStats = false }
        do {
            allianceStats = try await allianceService.getAllianceStats(id: allianceId)
        } catch {
            statsError = error.localizedDescription
            Logger.error("Failed to load stats: \(error)")
        }
    }

    func kickMember(_ memberId: String) async {
        guard let alliance = userAlliance else { return }
        isActionLoading = true
        defer { isActionLoading = false }
        do {
            let message = try await allianceService.kickMember(allianceId: alliance.id, memberId: memberId)
            self.successMessage = message
            await loadMembers()
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to kick member: \(error)")
        }
    }

    func updateMemberRole(_ memberId: String, role: String) async {
        guard let alliance = userAlliance else { return }
        isActionLoading = true
        defer { isActionLoading = false }
        do {
            let message = try await allianceService.updateMemberRole(allianceId: alliance.id, memberId: memberId, role: role)
            self.successMessage = message
            await loadMembers()
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to update role: \(error)")
        }
    }

    func transferLeadership(_ newLeaderId: String) async {
        guard let alliance = userAlliance else { return }
        isActionLoading = true
        defer { isActionLoading = false }
        do {
            let message = try await allianceService.transferLeadership(allianceId: alliance.id, newLeaderId: newLeaderId)
            self.successMessage = message
            loadUserAlliance(force: true) // Refresh to update userRole
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to transfer leadership: \(error)")
        }
    }

    func reviewApplication(_ applicationId: Int, action: String, message: String? = nil) async {
        guard let alliance = userAlliance else { return }
        isActionLoading = true
        defer { isActionLoading = false }
        do {
            let msg = try await allianceService.reviewApplication(allianceId: alliance.id, applicationId: applicationId, action: action, message: message)
            self.successMessage = msg
            await loadApplications()
            if action == "approve" {
                await loadMembers()
            }
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to review application: \(error)")
        }
    }

    func searchAlliances(isLoadMore: Bool = false) async {
        if !isLoadMore {
            isSearching = true
            currentOffset = 0
            searchResults = []
            hasMoreResults = true
        } else {
            guard hasMoreResults && !isLoadingMore else { return }
            isLoadingMore = true
        }
        
        defer { 
            isSearching = false
            isLoadingMore = false
        }

        do {
            let results = try await allianceService.searchAlliances(
                query: searchQuery,
                limit: limit,
                offset: currentOffset
            )
            
            if isLoadMore {
                searchResults.append(contentsOf: results)
            } else {
                searchResults = results
            }
            
            hasMoreResults = results.count >= limit
            currentOffset += results.count
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to search alliances: \(error)")
        }
    }

    func loadMoreAlliances() {
        Task {
            await searchAlliances(isLoadMore: true)
        }
    }

    func applyToAlliance(_ allianceId: Int) async {
        do {
            let message = try await allianceService.applyToAlliance(id: allianceId)
            Logger.info("Applied to alliance: \(message)")
            self.successMessage = message

            // ✨ Success feedback
            SoundManager.shared.playSuccess()
            HapticManager.shared.notification(type: .success)

            // Refresh alliance state if successfully joined (message contains "join" or "加入")
            if message.lowercased().contains("join") || message.contains("加入") {
                loadUserAlliance(force: true)
            }
        } catch {
            errorMessage = error.localizedDescription

            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            Logger.error("Failed to apply to alliance: \(error)")
        }
    }

    func leaveAlliance(allianceId: Int) async {
        do {
            let message = try await allianceService.leaveAlliance(allianceId: allianceId)
            Logger.info("Left alliance: \(message)")

            // Remove locally
            if let index = userAlliances.firstIndex(where: { $0.id == allianceId }) {
                userAlliances.remove(at: index)
            }

            // Update primary alliance if needed
            if userAlliance?.id == allianceId {
                userAlliance = userAlliances.first
                if let newPrimary = userAlliance {
                    // Load stats for new primary
                    do {
                         allianceStats = try await allianceService.getAllianceStats(id: newPrimary.id)
                    } catch {
                        Logger.error("Failed to load new primary stats: \(error)")
                    }
                } else {
                    allianceStats = nil
                }
            }

            successMessage = NSLocalizedString("alliance.leave.success", comment: "Left alliance")

            // ✨ Success feedback
            SoundManager.shared.playSuccess()
            HapticManager.shared.notification(type: .success)
        } catch {
            errorMessage = error.localizedDescription

            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            Logger.error("Failed to leave alliance: \(error)")
        }
    }

    func dissolveAlliance(allianceId: Int) async {
        do {
            let message = try await allianceService.dissolveAlliance(id: allianceId)
            Logger.info("Dissolved alliance: \(message)")

            // Remove locally
            if let index = userAlliances.firstIndex(where: { $0.id == allianceId }) {
                userAlliances.remove(at: index)
            }

            // Update primary alliance if needed
            if userAlliance?.id == allianceId {
                userAlliance = userAlliances.first
                if let newPrimary = userAlliance {
                    do {
                        allianceStats = try await allianceService.getAllianceStats(id: newPrimary.id)
                    } catch {
                        Logger.error("Failed to load new primary stats: \(error)")
                    }
                } else {
                    allianceStats = nil
                }
            }

            successMessage = NSLocalizedString("alliance.dissolve.success", comment: "Alliance dissolved")
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to dissolve alliance: \(error)")
        }
    }

    func generateInviteCode() async {
        guard let alliance = userAlliance else { return }

        do {
            let (inviteLink, code, expiresAt, _) = try await allianceService.generateInviteLink(allianceId: alliance.id)
            inviteCode = code
            showInviteCode = true
            Logger.info("Generated invite link: \(inviteLink), expires: \(expiresAt)")
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to generate invite link: \(error)")
        }
    }
    
    func updateAlliance(name: String? = nil, flagPatternId: String? = nil, notice: String? = nil) async {
        guard let alliance = userAlliance else { return }
        isActionLoading = true
        defer { isActionLoading = false }
        
        do {
            let updatedAlliance = try await allianceService.updateAlliance(
                id: alliance.id,
                name: name,
                notice: notice,
                flagPatternId: flagPatternId
            )
            self.userAlliance = updatedAlliance
            self.successMessage = NSLocalizedString("alliance.update.success", comment: "Update successful")
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to update alliance: \(error)")
        }
    }
}

/// 创建联盟ViewModel
@MainActor
class CreateAllianceViewModel: ObservableObject {
    @Published var allianceName = ""
    @Published var allianceDescription = ""
    @Published var isPublic = true
    @Published var approvalRequired = true
    @Published var flagPatternId = ""
    @Published var flagPatterns = AllianceService.FlagPatternsResponse.PatternCategories(colors: [], emojis: [], complex: [])
    @Published var isCreating = false
    @Published var isSuccess = false
    @Published var showSuccessAlert = false
    @Published var showError = false
    @Published var errorMessage = ""
    @Published var successMessage = ""

    var selectedPattern: AllianceService.FlagPattern? {
        guard !flagPatternId.isEmpty else { return nil }
        let allPatterns = flagPatterns.colors + flagPatterns.emojis + flagPatterns.complex
        // 尝试匹配 patternId 或 key 或 id
        return allPatterns.first(where: {
            $0.patternId == flagPatternId ||
            $0.key == flagPatternId ||
            String($0.id) == flagPatternId
        })
    }

    var selectedPatternUnicodeChar: String? {
        selectedPattern?.unicodeChar
    }

    var isValid: Bool {
        !allianceName.isEmpty && !flagPatternId.isEmpty
    }

    var selectedPatternName: String {
        selectedPattern?.name ?? NSLocalizedString("common.select", comment: "Select")
    }

    private let allianceService = AllianceService.shared

    func loadFlagPatterns() {
        Task {
            do {
                let patterns = try await allianceService.getFlagPatterns()
                flagPatterns = patterns

                // 默认选择第一个颜色
                if let firstColor = patterns.colors.first {
                    flagPatternId = firstColor.key ?? firstColor.patternId ?? String(firstColor.id)
                }
            } catch {
                Logger.error("Failed to load flag patterns: \(error)")
            }
        }
    }

    func createAlliance(onSuccess: (() -> Void)? = nil) async {
        guard isValid else { return }

        isCreating = true
        defer { isCreating = false }

        do {
            let alliance = try await allianceService.createAlliance(
                name: allianceName,
                description: allianceDescription.isEmpty ? nil : allianceDescription,
                flagPatternId: flagPatternId,
                isPublic: isPublic,
                approvalRequired: approvalRequired
            )

            successMessage = NSLocalizedString("alliance.create.success", comment: "Alliance created successfully!")
            isSuccess = true
            showSuccessAlert = true

            // ✨ Success feedback
            SoundManager.shared.playSuccess()
            HapticManager.shared.notification(type: .success)

            onSuccess?()
            Logger.info("Alliance created successfully: \(alliance.name)")
        } catch {
            errorMessage = error.localizedDescription
            showError = true

            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            Logger.error("Failed to create alliance: \(error)")
        }
    }
}

/// 旗帜图案ViewModel
@MainActor
class FlagPatternViewModel: ObservableObject {
    @Published var flagPatterns = AllianceService.FlagPatternsResponse.PatternCategories(colors: [], emojis: [], complex: [])
    @Published var selectedCategory = "color"
    @Published var selectedPattern: AllianceService.FlagPattern?
    @Published var isLoading = false

    private let allianceService = AllianceService.shared

    func loadPatterns() async {
        isLoading = true
        defer { isLoading = false }

        do {
            flagPatterns = try await allianceService.getFlagPatterns()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            Logger.error("Failed to load flag patterns: \(error)")
        }
    }
    
    @Published var showError = false
    @Published var errorMessage = ""
}

/// 联盟编辑视图
struct AllianceEditView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: AllianceViewModel
    @StateObject private var patternViewModel = FlagPatternViewModel()
    
    @State private var name: String = ""
    @State private var notice: String = ""
    @State private var selectedFlagPatternId: String = ""
    @State private var selectedFlagPatternName: String = ""
    @State private var showFlagSelector = false
    
    // 初始化数据
    init(viewModel: AllianceViewModel) {
        self.viewModel = viewModel
        _name = State(initialValue: viewModel.userAlliance?.name ?? "")
        _notice = State(initialValue: viewModel.userAlliance?.notice ?? "")
        _selectedFlagPatternId = State(initialValue: viewModel.userAlliance?.flagPatternId ?? "")
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text(NSLocalizedString("alliance.form.basic", comment: "Basic Info"))) {
                    // 名称编辑
                    HStack {
                        Text(NSLocalizedString("alliance.form.name", comment: "Name"))
                            .frame(width: 80, alignment: .leading)
                        TextField(NSLocalizedString("alliance.create.name", comment: "Alliance Name"), text: $name)
                    }
                    
                    // 公告编辑
                    VStack(alignment: .leading, spacing: 8) {
                        Text(NSLocalizedString("alliance.form.notice", comment: "Announcement"))
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                        
                        TextEditor(text: $notice)
                            .frame(height: 100)
                            .padding(4)
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                    }
                    .padding(.vertical, 4)
                }
                
                Section(header: Text(NSLocalizedString("alliance.form.flag", comment: "Flag"))) {
                    // 旗帜选择
                    Button(action: {
                        showFlagSelector = true
                    }) {
                        HStack {
                            Text(NSLocalizedString("alliance.form.pattern", comment: "Pattern"))
                            Spacer()
                            if !selectedFlagPatternId.isEmpty {
                                Text(selectedFlagPatternName.isEmpty ? selectedFlagPatternId.prefix(10) : Substring(selectedFlagPatternName)) 
                                    .foregroundColor(.secondary)
                            } else {
                                Text(NSLocalizedString("common.select", comment: "Select"))
                                    .foregroundColor(.secondary)
                            }
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                }
                
                Section {
                    Button(action: {
                        saveChanges()
                    }) {
                        if viewModel.isActionLoading {
                            HStack {
                                Spacer()
                                ProgressView()
                                Spacer()
                            }
                        } else {
                            Text(NSLocalizedString("common.save", comment: "Save"))
                                .frame(maxWidth: .infinity)
                                .fontWeight(.semibold)
                                .foregroundColor(.blue)
                        }
                    }
                }
            }
            .navigationTitle(NSLocalizedString("alliance.edit.title", comment: "Edit Alliance"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.cancel", comment: "Cancel")) {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showFlagSelector) {
                NavigationStack {
                    FlagPatternSelectorView(selectedPatternId: $selectedFlagPatternId, onSelection: { id, name in
                        selectedFlagPatternName = name
                    })
                }
            }
            .alert(isPresented: Binding(
                get: { viewModel.successMessage != nil },
                set: { if !$0 { viewModel.successMessage = nil } }
            )) {
                Alert(
                    title: Text(NSLocalizedString("common.success", comment: "Success")),
                    message: Text(viewModel.successMessage ?? ""),
                    dismissButton: .default(Text(NSLocalizedString("common.confirm", comment: "OK"))) {
                        dismiss()
                    }
                )
            }
            .onAppear {
                resolvePatternName()
            }
        }
    }
    
    private func saveChanges() {
        Task {
            await viewModel.updateAlliance(name: name, flagPatternId: selectedFlagPatternId, notice: notice)
        }
    }
    
    private func resolvePatternName() {
        guard !selectedFlagPatternId.isEmpty else { return }
        // 尝试从patternViewModel已加载的图案中查找
        let allPatterns = patternViewModel.flagPatterns.colors + patternViewModel.flagPatterns.emojis + patternViewModel.flagPatterns.complex
        if let pattern = allPatterns.first(where: { 
            $0.patternId == selectedFlagPatternId || 
            $0.key == selectedFlagPatternId ||
            String($0.id) == selectedFlagPatternId
        }) {
            selectedFlagPatternName = pattern.name
        } else {
             // If not found, trigger load
             Task {
                 await patternViewModel.loadPatterns()
                 // Retry after load
                 let newPatterns = patternViewModel.flagPatterns.colors + patternViewModel.flagPatterns.emojis + patternViewModel.flagPatterns.complex
                 if let found = newPatterns.first(where: {
                     $0.patternId == selectedFlagPatternId ||
                     $0.key == selectedFlagPatternId ||
                     String($0.id) == selectedFlagPatternId
                 }) {
                     selectedFlagPatternName = found.name
                 }
             }
        }
    }
}

/// 联盟详情页
struct AllianceDetailPage: View {
    let alliance: AllianceService.Alliance
    @ObservedObject var viewModel: AllianceViewModel
    
    @State private var stats: AllianceService.AllianceStats?
    @State private var showEditAlliance = false
    @State private var showLeaveConfirmation = false
    @State private var showDissolveConfirmation = false
    @State private var showInviteCode = false
    @State private var inviteCode = ""
    @State private var showShareSheet = false
    @State private var shareItems: [Any] = []

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.xl) {
                // 1. 顶部主要卡片
                AllianceHeaderView(alliance: alliance, stats: stats) {
                    if alliance.userRole == "leader" {
                        showEditAlliance = true
                        viewModel.userAlliance = alliance
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    if alliance.userRole == "leader" {
                        showEditAlliance = true
                        viewModel.userAlliance = alliance
                    }
                }

                // 2. 贡献排行
                AllianceContributionSection(allianceId: alliance.id)

                // 4. Activity Log
                AllianceActivityLogSection(allianceId: alliance.id)

                // 5. 功能菜单列表
                AllianceMenuListView(alliance: alliance, viewModel: viewModel, onInvite: {
                    Task {
                        viewModel.userAlliance = alliance
                        await viewModel.generateInviteCode()
                        if viewModel.showInviteCode {
                            inviteCode = viewModel.inviteCode
                            showInviteCode = true
                        }
                    }
                })
                
                // 3. 退出/转让功能改进
                AllianceManagementView(alliance: alliance, viewModel: viewModel, onTransferRequest: {
                    // Transfer request logic handled in subview or navigation
                }, onLeaveRequest: {
                   showLeaveConfirmation = true
                }, onDissolveRequest: {
                   showDissolveConfirmation = true
                })
            }
            .padding()
        }
        .navigationTitle(alliance.name)
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .background(AppColors.background)
        .refreshable {
            do {
                stats = try await AllianceService.shared.getAllianceStats(id: alliance.id)
            } catch {
                Logger.error("Failed to refresh stats for alliance \(alliance.id): \(error)")
            }
        }
        .task {
            // Ensure ViewModel tracks this alliance for action methods (kick, promote, etc.)
            viewModel.userAlliance = alliance
            do {
                stats = try await AllianceService.shared.getAllianceStats(id: alliance.id)
            } catch {
                Logger.error("Failed to load stats for alliance \(alliance.id): \(error)")
            }
        }
        .sheet(isPresented: $showEditAlliance) {
             AllianceEditView(viewModel: viewModel)
        }
        .alert(NSLocalizedString("alliance.invite.title", comment: "Invite Code"), isPresented: $showInviteCode) {
            Button(NSLocalizedString("alliance.invite.copy", comment: "Copy"), action: {
                UIPasteboard.general.string = inviteCode
                HapticManager.shared.notification(type: .success)
            })
            Button(NSLocalizedString("alliance.share.invite", comment: "Share Invite")) {
                let inviteUrl = "funnypixels://alliance/join?code=\(inviteCode)"
                let shareText = String(format: NSLocalizedString("alliance.invite.message", comment: "Invite Message"), inviteCode) + "\n\(inviteUrl)"
                shareItems = [shareText]
                showShareSheet = true
            }
            Button(NSLocalizedString("common.confirm", comment: "OK"), role: .cancel) { }
        } message: {
            Text(inviteCode)
        }
        .sheet(isPresented: $showShareSheet) {
            if !shareItems.isEmpty {
                ActivityViewController(activityItems: shareItems)
            }
        }
        .alert(NSLocalizedString("alliance.leave.title", comment: "Leave Alliance"), isPresented: $showLeaveConfirmation) {
            Button(NSLocalizedString("common.cancel", comment: "Cancel"), role: .cancel) {}
            Button(NSLocalizedString("common.confirm", comment: "Confirm"), role: .destructive) {
                Task {
                    await viewModel.leaveAlliance(allianceId: alliance.id)
                }
            }
        } message: {
            Text(NSLocalizedString("alliance.leave.message", comment: "Are you sure you want to leave?"))
        }
        .alert(NSLocalizedString("alliance.dissolve.title", comment: "Dissolve Alliance"), isPresented: $showDissolveConfirmation) {
            Button(NSLocalizedString("common.cancel", comment: "Cancel"), role: .cancel) {}
            Button(NSLocalizedString("common.confirm", comment: "Confirm"), role: .destructive) {
                Task { await viewModel.dissolveAlliance(allianceId: alliance.id) }
            }
        } message: {
            Text(NSLocalizedString("alliance.dissolve.message", comment: "Are you sure you want to dissolve?"))
        }
    }
}

/// 联盟列表行视图
struct AllianceListRow: View {
    let alliance: AllianceService.Alliance

    var body: some View {
        HStack(spacing: 12) {
            // Flag
            flagView
            
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(alliance.name)
                        .font(.headline)
                        .foregroundColor(.primary)

                    if let level = alliance.level {
                        AllianceLevelBadge(level: level, levelName: alliance.levelNameEn)
                    }
                }

                HStack(spacing: 8) {
                     // Role Badge
                     roleBadge(role: alliance.userRole ?? "member")
                     
                     // Members count
                     Label("\(alliance.memberCount)", systemImage: "person.2.fill")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            
            Spacer()
            
            // Interactive indicator
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold)) // Slightly bolder
                .foregroundColor(.gray.opacity(0.4))
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .cornerRadius(AppRadius.xl)
        .modifier(AppShadows.medium())
    }
    
    private var flagView: some View {
         ZStack {
             RoundedRectangle(cornerRadius: 10)
                 .fill(allianceColor.opacity(0.1))
                 .frame(width: 48, height: 48)

             if let renderType = alliance.flagRenderType,
                let unicodeChar = alliance.flagUnicodeChar,
                (renderType == "emoji" || renderType == "color") {
                 Text(unicodeChar)
                     .font(.system(size: 24))
             } else if let renderType = alliance.flagRenderType,
                   renderType == "complex" {
                 if let payload = alliance.flagPayload,
                    let data = Data(base64Encoded: payload.replacingOccurrences(of: "data:image/png;base64,", with: "")),
                    let uiImage = UIImage(data: data) {
                   Image(uiImage: uiImage)
                       .resizable()
                       .aspectRatio(contentMode: .fit)
                       .frame(width: 36, height: 36)
                 } else if let url = alliance.flagSpriteURL {
                     CachedAsyncImagePhase(url: url) { phase in
                         switch phase {
                         case .success(let image):
                             image
                                 .resizable()
                                 .aspectRatio(contentMode: .fit)
                                 .frame(width: 36, height: 36)
                         case .failure:
                             Image(systemName: "flag.fill")
                                 .font(.system(size: 20))
                                 .foregroundColor(allianceColor)
                         case .empty:
                             ProgressView().scaleEffect(0.5)
                         @unknown default:
                             EmptyView()
                         }
                     }
                 } else {
                     Image(systemName: "flag.fill")
                         .font(.system(size: 20))
                         .foregroundColor(allianceColor)
                 }
         }
    }
    }
    
    private func roleBadge(role: String) -> some View {
        Text(roleDisplayName(role))
            .font(.system(size: 9, weight: .bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(roleColor(role).opacity(0.1))
            .foregroundColor(roleColor(role))
            .cornerRadius(6)
    }
    
    // Helpers copied locally to avoid dependency on private external ones or messy access
    private var allianceColor: Color {
        if let colorHex = alliance.color {
            return Color(hex: colorHex) ?? .blue
        }
        return .blue
    }
    
    private func roleDisplayName(_ role: String) -> String {
        switch role {
        case "leader": return NSLocalizedString("alliance.role.leader", comment: "Leader")
        case "admin": return NSLocalizedString("alliance.role.admin", comment: "Admin")
        case "member": return NSLocalizedString("alliance.role.member", comment: "Member")
        default: return role
        }
    }
    
    private func roleColor(_ role: String) -> Color {
        switch role {
        case "leader": return .red
        case "admin": return .blue
        default: return .gray
        }
    }
}

// MARK: - Subviews

struct AllianceHeaderView: View {
    let alliance: AllianceService.Alliance
    let stats: AllianceService.AllianceStats?
    var onEdit: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // 旗帜与名称 - 水平布局
            HStack(spacing: 12) {
                // 旗帜
                flagView
                
                VStack(alignment: .leading, spacing: 4) {
                    // 名称 + 等级徽章
                    HStack(spacing: 6) {
                        Text(alliance.name)
                            .font(.headline)
                            .foregroundColor(Color(uiColor: .darkGray))
                            .lineLimit(1)

                        if let level = alliance.level {
                            AllianceLevelBadge(level: level, levelName: alliance.levelNameEn)
                        }
                    }

                    HStack(spacing: 6) {
                        // 盟主名称
                        if let leaderName = alliance.leaderName {
                            leaderLabel(name: leaderName)
                        }

                        // 角色标记
                        if let role = alliance.userRole, role != "leader" {
                            roleLabel(role: role)
                        }
                    
                        // 联盟公告栏
                        noticeLabel
                    }

                    // Alliance description
                    if let desc = alliance.description, !desc.isEmpty {
                        Text(desc)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textSecondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

            // 更多编辑箭头 (仅盟主可见)
                if alliance.userRole == "leader" {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14))
                        .foregroundColor(.gray.opacity(0.5))
                }
            }
            .padding(.bottom, 4) // Add space before divider
            
            // 等级进度
            if alliance.level != nil {
                AllianceLevelCard(alliance: alliance)
            }

            Divider()
                .opacity(0.6)

            // 简单统计 - Enhanced Grid
            statsRow
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .cornerRadius(AppRadius.xl)
        .modifier(AppShadows.medium())
    }

    private var flagView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(allianceColor(for: alliance).opacity(0.1))
                .frame(width: 56, height: 56)
            
            if let renderType = alliance.flagRenderType,
               (renderType == "emoji" || renderType == "color"),
               let unicodeChar = alliance.flagUnicodeChar {
                Text(unicodeChar)
                    .font(.system(size: 28))
            } else if let renderType = alliance.flagRenderType,
                  renderType == "complex",
                  let payload = alliance.flagPayload {
                  
                  let cleanPayload = payload.replacingOccurrences(of: "data:image/png;base64,", with: "")
                  if let data = Data(base64Encoded: cleanPayload, options: .ignoreUnknownCharacters),
                     let uiImage = UIImage(data: data) {
                      Image(uiImage: uiImage)
                          .resizable()
                          .aspectRatio(contentMode: .fit)
                          .frame(width: 40, height: 40)
                  } else {
                      let _ = Logger.error("Failed to decode flag payload. Type: \(renderType), Payload prefix: \(payload.prefix(50))")
                      Image(systemName: "exclamationmark.triangle")
                          .font(.system(size: 20))
                          .foregroundColor(.red)
                  }
            } else {
                let _ = Logger.debug("Alliance Flag Render Fallback - ID: \(alliance.flagPatternId ?? "nil"), type: \(alliance.flagRenderType ?? "nil"), hasPayload: \(alliance.flagPayload != nil), hasUnicode: \(alliance.flagUnicodeChar != nil)")
                Image(systemName: "flag.fill")
                    .font(.system(size: 20))
                    .foregroundColor(allianceColor(for: alliance))
            }
        }
    }
    
    private func leaderLabel(name: String) -> some View {
        HStack(spacing: 2) {
            Text(NSLocalizedString("alliance.role.leader", comment: "Leader"))
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 4)
                .padding(.vertical, 1)
                .background(Color.orange)
                .cornerRadius(4)
            
            Text(name)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
    
    private func roleLabel(role: String) -> some View {
        Text(roleDisplayName(role))
            .font(.system(size: 9, weight: .bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(roleColor(role).opacity(0.1))
            .foregroundColor(roleColor(role))
            .cornerRadius(6)
    }

    private var noticeLabel: some View {
        HStack(spacing: 6) {
            Image(systemName: "speaker.wave.2.fill")
                .font(.caption)
                .foregroundColor(.orange)
            
            Text(alliance.notice?.isEmpty == false ? alliance.notice! : NSLocalizedString("alliance.notice.empty", comment: "No announcement"))
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(1)
            
            Spacer()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.orange.opacity(0.08))
        .cornerRadius(8)
    }
    
    private var statsRow: some View {
        HStack {
           VStack(spacing: 2) {
               Text("\(alliance.memberCount)")
                   .font(.system(size: 14, weight: .bold))
               Text(NSLocalizedString("alliance.members", comment: "Members"))
                   .font(.system(size: 10))
                   .foregroundColor(.secondary)
           }
           .frame(maxWidth: .infinity)
           
           Rectangle()
               .fill(Color(.systemGray5))
               .frame(width: 1, height: 16)
           
           VStack(spacing: 2) {
               Text("\(stats?.totalPixels ?? 0)")
                   .font(.system(size: 14, weight: .bold))
               Text(NSLocalizedString("alliance.total_pixels", comment: "Total Pixels"))
                   .font(.system(size: 10))
                   .foregroundColor(.secondary)
           }
           .frame(maxWidth: .infinity)
           
           Rectangle()
               .fill(Color(.systemGray5))
               .frame(width: 1, height: 16)
           
           VStack(spacing: 2) {
               Text("#\(stats?.rank ?? 0)")
                   .font(.system(size: 14, weight: .bold))
               Text(NSLocalizedString("alliance.rank", comment: "Rank"))
                   .font(.system(size: 10))
                   .foregroundColor(.secondary)
           }
           .frame(maxWidth: .infinity)
       }
       .padding(.vertical, 4)
    }
    
    // Helpers copied from main view or shared
    private func allianceColor(for alliance: AllianceService.Alliance) -> Color {
        if let colorHex = alliance.color {
            return Color(hex: colorHex) ?? .blue
        }
        return .blue
    }
    
    private func roleDisplayName(_ role: String) -> String {
        switch role {
        case "leader": return NSLocalizedString("alliance.role.leader", comment: "Leader")
        case "admin": return NSLocalizedString("alliance.role.admin", comment: "Admin")
        case "member": return NSLocalizedString("alliance.role.member", comment: "Member")
        default: return role
        }
    }
    
    private func roleColor(_ role: String) -> Color {
        switch role {
        case "leader": return .red
        case "admin": return .blue
        default: return .gray
        }
    }
}

struct AllianceMenuListView: View {
    let alliance: AllianceService.Alliance
    @ObservedObject var viewModel: AllianceViewModel
    var onInvite: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            NavigationLink {
                AllianceContributionFullView(allianceId: alliance.id)
            } label: {
                StandardListRow(title: NSLocalizedString("alliance.menu.contributions", comment: ""), subtitle: NSLocalizedString("alliance.menu.contributions.subtitle", comment: ""), icon: "trophy")
            }

            Divider().padding(.leading, 56)

            NavigationLink {
                AllianceMemberListView(viewModel: viewModel, allianceId: alliance.id)
            } label: {
                StandardListRow(title: NSLocalizedString("alliance.menu.members", comment: ""), subtitle: NSLocalizedString("alliance.menu.members.subtitle", comment: ""), icon: "person.2")
            }

            Divider().padding(.leading, 56)

            NavigationLink {
                AllianceStatsView(viewModel: viewModel, allianceId: alliance.id)
            } label: {
                StandardListRow(title: NSLocalizedString("alliance.menu.stats", comment: ""), subtitle: NSLocalizedString("alliance.menu.stats.subtitle", comment: ""), icon: "chart.bar")
            }

            if alliance.userRole == "leader" || alliance.userRole == "admin" {
                Divider().padding(.leading, 56)
                NavigationLink {
                    AllianceApplicationsView(viewModel: viewModel, allianceId: alliance.id)
                } label: {
                    StandardListRow(title: NSLocalizedString("alliance.menu.applications", comment: ""), subtitle: NSLocalizedString("alliance.menu.applications.subtitle", comment: ""), icon: "doc.text") {
                        if viewModel.pendingApplications > 0 {
                            Text("\(viewModel.pendingApplications)")
                                .font(AppTypography.caption())
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.red)
                                .clipShape(Capsule())
                        }
                    }
                }
            }

            Divider().padding(.leading, 56)
            StandardListRow(title: NSLocalizedString("alliance.menu.invite", comment: ""), subtitle: NSLocalizedString("alliance.menu.invite.subtitle", comment: ""), icon: "square.and.arrow.up", action: onInvite)
        }
        .background(AppColors.surface)
        .cornerRadius(AppRadius.l)
        .modifier(AppShadows.medium())
    }
}

struct AllianceManagementView: View {
    let alliance: AllianceService.Alliance
    @ObservedObject var viewModel: AllianceViewModel
    var onTransferRequest: () -> Void
    var onLeaveRequest: () -> Void
    var onDissolveRequest: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            if alliance.userRole == "leader" {
                if alliance.memberCount > 1 {
                    NavigationLink {
                        AllianceMemberListView(viewModel: viewModel, allianceId: alliance.id)
                    } label: {
                        HStack {
                            Image(systemName: "arrow.2.squarepath")
                            Text(NSLocalizedString("alliance.action.transfer", comment: ""))
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.m)
                        .background(AppColors.surface)
                        .cornerRadius(AppRadius.l)
                        .modifier(AppShadows.small())
                    }

                    Button(action: {
                        viewModel.errorMessage = NSLocalizedString("alliance.error.transfer_required", comment: "")
                    }) {
                        Text(NSLocalizedString("alliance.action.leave", comment: ""))
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(AppColors.textTertiary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, AppSpacing.m)
                            .background(AppColors.surface)
                            .cornerRadius(AppRadius.l)
                            .modifier(AppShadows.small())
                    }
                } else {
                    StandardButton(
                        title: NSLocalizedString("alliance.action.dissolve", comment: ""),
                        style: .destructive,
                        size: .medium,
                        action: onDissolveRequest
                    )

                    Text(NSLocalizedString("alliance.msg.dissolve", comment: ""))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
            } else {
                StandardButton(
                    title: NSLocalizedString("alliance.action.leave", comment: ""),
                    style: .destructive,
                    size: .medium,
                    action: onLeaveRequest
                )
            }
        }
    }
}

// MARK: - Activity View Controller Wrapper

private struct ActivityViewController: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
