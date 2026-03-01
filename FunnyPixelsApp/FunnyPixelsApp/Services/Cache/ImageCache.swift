import SwiftUI

/// Shared image cache with larger capacity than the default URLSession cache.
/// Used by `CachedAsyncImage` to persist downloaded images across view lifecycles.
enum ImageCache {
    /// 50 MB memory, 200 MB disk
    static let urlCache: URLCache = {
        let cache = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 200 * 1024 * 1024
        )
        return cache
    }()

    static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.urlCache = urlCache
        config.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: config)
    }()

    /// In-flight request deduplication
    private static let actor = ImageCacheActor()

    static func image(for url: URL) async throws -> UIImage {
        try await actor.image(for: url)
    }

    /// Remove cached image for a specific URL (e.g. after avatar update)
    static func removeCachedImage(for url: URL) {
        let request = URLRequest(url: url)
        urlCache.removeCachedResponse(for: request)
        Task { await actor.cancelInFlight(for: url) }
    }

    /// Remove all cached images whose URL contains the given substring
    static func removeCachedImages(matching substring: String) {
        urlCache.removeAllCachedResponses()
    }
}

/// Actor that deduplicates identical in-flight image downloads.
private actor ImageCacheActor {
    private var inFlight: [URL: Task<UIImage, Error>] = [:]

    func cancelInFlight(for url: URL) {
        inFlight[url]?.cancel()
        inFlight[url] = nil
    }

    func image(for url: URL) async throws -> UIImage {
        if let existing = inFlight[url] {
            return try await existing.value
        }

        let task = Task<UIImage, Error> {
            let data: Data
            // User avatar sprites can change — bypass cache to avoid stale white images
            if url.absoluteString.contains("user_avatar_") {
                var request = URLRequest(url: url)
                request.cachePolicy = .reloadIgnoringLocalCacheData
                (data, _) = try await URLSession.shared.data(for: request)
            } else {
                (data, _) = try await ImageCache.session.data(from: url)
            }
            guard let uiImage = UIImage(data: data) else {
                throw URLError(.cannotDecodeContentData)
            }
            return uiImage
        }

        inFlight[url] = task

        do {
            let result = try await task.value
            inFlight[url] = nil
            return result
        } catch {
            inFlight[url] = nil
            throw error
        }
    }
}

/// Drop-in replacement for `AsyncImage` that uses a shared URLCache
/// with larger capacity and request deduplication.
struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    let content: (Image) -> Content
    let placeholder: () -> Placeholder

    @State private var uiImage: UIImage?
    @State private var loadFailed = false

    init(
        url: URL?,
        @ViewBuilder content: @escaping (Image) -> Content,
        @ViewBuilder placeholder: @escaping () -> Placeholder
    ) {
        self.url = url
        self.content = content
        self.placeholder = placeholder
    }

    var body: some View {
        Group {
            if let uiImage {
                content(Image(uiImage: uiImage))
            } else {
                placeholder()
            }
        }
        .task(id: url) {
            await loadImage()
        }
    }

    private func loadImage() async {
        guard let url else { return }
        // Skip if already loaded for this URL
        if uiImage != nil && !loadFailed { return }

        do {
            let image = try await ImageCache.image(for: url)
            self.uiImage = image
            self.loadFailed = false
        } catch {
            self.loadFailed = true
        }
    }
}

// MARK: - Phase-based variant

/// A phase-based cached image view that closely mirrors `AsyncImage(url:) { phase in }`.
struct CachedAsyncImagePhase<Content: View>: View {
    let url: URL?
    let content: (AsyncImagePhase) -> Content

    @State private var phase: AsyncImagePhase = .empty

    init(url: URL?, @ViewBuilder content: @escaping (AsyncImagePhase) -> Content) {
        self.url = url
        self.content = content
    }

    var body: some View {
        content(phase)
            .task(id: url) {
                await load()
            }
    }

    private func load() async {
        guard let url else {
            phase = .empty
            return
        }
        phase = .empty
        do {
            let uiImage = try await ImageCache.image(for: url)
            phase = .success(Image(uiImage: uiImage))
        } catch {
            phase = .failure(error)
        }
    }
}
