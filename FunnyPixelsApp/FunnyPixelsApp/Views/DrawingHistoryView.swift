import SwiftUI

/// 作品画廊主界面 - 瀑布流展示
struct DrawingHistoryView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = DrawingHistoryViewModel()
    @State private var showFilters = false
    @ObservedObject private var fontManager = FontSizeManager.shared
    
    var body: some View {
        NavigationStack {
            ZStack {
                if !authViewModel.isAuthenticated {
                    guestGalleryPrompt
                } else if viewModel.isLoading && viewModel.sessions.isEmpty {
                    skeletonLoadingView
                } else if viewModel.sessions.isEmpty {
                    emptyStateView
                } else {
                    // 视图内容（根据模式切换）
                    Group {
                        if viewModel.viewMode == .grid {
                            galleryGridView
                                .transition(.opacity)
                        } else {
                            galleryListView
                                .transition(.opacity)
                        }
                    }
                    .animation(.easeInOut(duration: 0.2), value: viewModel.viewMode)
                }
            }
            .navigationTitle(NSLocalizedString("gallery.title", comment: "Artwork Gallery"))
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .top, spacing: 0) {
                // 🚀 优化：离线模式提示条
                if viewModel.isOfflineMode {
                    HStack(spacing: 8) {
                        Image(systemName: "wifi.slash")
                            .font(.caption)
                        Text(NSLocalizedString("gallery.offline_mode", comment: ""))
                            .font(.caption)
                        Spacer()
                        Button(action: {
                            Task {
                                await viewModel.refresh()
                            }
                        }) {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                        }
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.orange)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {

                    HStack(spacing: 12) {
                        // 视图模式切换
                        Button(action: {
                            withAnimation {
                                viewModel.viewMode = viewModel.viewMode == .grid ? .list : .grid
                            }
                        }) {
                            Image(systemName: viewModel.viewMode == .grid ? "list.bullet" : "square.grid.2x2")
                        }
                        
                        // 筛选按钮
                        Button(action: { showFilters.toggle() }) {
                            Image(systemName: "line.3.horizontal.decrease.circle")
                        }
                    }
                }
            }
            .sheet(isPresented: $showFilters) {
                filterSheet
            }
            .task {
                await viewModel.loadSessions(refresh: true)
            }
            .refreshable {
                await viewModel.refresh()
            }
            .alert(NSLocalizedString("common.error", comment: "Error"), isPresented: $viewModel.showError) {
                Button(NSLocalizedString("common.confirm", comment: "OK")) {}
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }
    
    // MARK: - Gallery Grid View
    
    private var galleryGridView: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                ForEach(Array(viewModel.sessions.enumerated()), id: \.element.id) { index, session in
                    NavigationLink(destination: SessionDetailView(sessionId: session.id)) {
                        ArtworkCard(session: session)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .task {
                        // 🚀 优化：智能预加载 - 滚动到倒数第5个时预加载下一页
                        if viewModel.shouldPrefetchMore(currentIndex: index) {
                            await viewModel.loadMore()
                        }
                    }
                }

                // Load more indicator
                if viewModel.hasMore {
                    GridRow {
                        ProgressView()
                            .gridCellColumns(2)
                            .padding()
                    }
                }
            }
            .padding()
        }
    }
    
    // MARK: - Gallery List View
    
    private var galleryListView: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(Array(viewModel.sessions.enumerated()), id: \.element.id) { index, session in
                    NavigationLink(destination: SessionDetailView(sessionId: session.id)) {
                        ArtworkListRow(session: session)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .task {
                        // 🚀 优化：智能预加载 - 滚动到倒数第5个时预加载下一页
                        if viewModel.shouldPrefetchMore(currentIndex: index) {
                            await viewModel.loadMore()
                        }
                    }
                }

                // Load more indicator
                if viewModel.hasMore {
                    ProgressView()
                        .padding()
                }
            }
            .padding()
        }
    }
    
    // MARK: - Empty State
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(DesignTokens.Typography.largeTitle)
                .foregroundColor(.secondary)
            
            Text(NSLocalizedString("gallery.empty.title", comment: "No Artworks Yet"))
                .font(.title3)
                .fontWeight(.semibold)
            
            Text(NSLocalizedString("gallery.empty.message", comment: "Start your first creation"))
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Skeleton Loading
    
    private var skeletonLoadingView: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                ForEach(0..<6, id: \.self) { _ in
                    ArtworkCardSkeleton()
                }
            }
            .padding()
        }
    }
    
    // MARK: - Guest Prompt
    
    private var guestGalleryPrompt: some View {
        VStack(spacing: 24) {
            Image(systemName: "photo.stack.fill")
                .font(.system(size: 80))
                .foregroundColor(.blue.opacity(0.8))
                .padding(.top, 40)
            
            VStack(spacing: 12) {
                Text(NSLocalizedString("gallery.guest.title", comment: "Record Your Creativity"))
                    .font(.title3)
                    .fontWeight(.bold)
                
                Text(NSLocalizedString("gallery.guest.message", comment: "Login to view artworks"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            
            Button(action: {
                NotificationCenter.default.post(name: NSNotification.Name("ShowAuthSheet"), object: nil)
            }) {
                Text(NSLocalizedString("history.login_register", comment: "Login / Sign Up"))
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.blue)
                    .cornerRadius(25)
                    .shadow(radius: 4)
            }
            .padding(.horizontal, 40)
            .padding(.top, 10)
            
            Spacer()
        }
        .padding(.top, 20)
    }
    
    // MARK: - Filter Sheet
    
    private var filterSheet: some View {
        NavigationStack {
            Form {
                Section(NSLocalizedString("history.filter.date", comment: "Date Range")) {
                    Toggle(NSLocalizedString("history.filter.enable_date", comment: "Enable Date Filter"), isOn: $viewModel.useDateFilter)

                    if viewModel.useDateFilter {
                        DatePicker(NSLocalizedString("history.filter.start_date", comment: "Start Date"), selection: $viewModel.startDate, displayedComponents: .date)
                            .environment(\.locale, Locale.current)
                        DatePicker(NSLocalizedString("history.filter.end_date", comment: "End Date"), selection: $viewModel.endDate, displayedComponents: .date)
                            .environment(\.locale, Locale.current)
                    }
                }

                Section(NSLocalizedString("history.filter.city", comment: "City")) {
                    TextField(NSLocalizedString("history.filter.city_placeholder", comment: "Enter city name"), text: $viewModel.cityFilter)
                        .autocorrectionDisabled()
                }
            }
            .navigationTitle(NSLocalizedString("history.filter.title", comment: "Filter"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(NSLocalizedString("history.filter.reset", comment: "Reset")) {
                        viewModel.useDateFilter = false
                        viewModel.startDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
                        viewModel.endDate = Date()
                        viewModel.cityFilter = ""
                    }
                    .foregroundColor(.secondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("history.filter.done", comment: "Done")) {
                        showFilters = false
                        Task {
                            await viewModel.refresh()
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    DrawingHistoryView()
        .environmentObject(AuthViewModel())
}
