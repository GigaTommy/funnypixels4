import SwiftUI
import UIKit
import Combine

struct AdImageCropperView: View {
    let image: UIImage
    let targetWidth: Int
    let targetHeight: Int
    @ObservedObject var state: AdImageCropperState
    let onCropChanged: (UIImage?) -> Void

    var body: some View {
        GeometryReader { geo in
            let padding: CGFloat = 16
            let availableWidth = max(1, geo.size.width - padding * 2)
            let availableHeight = max(1, geo.size.height - 24)
            let aspect = CGFloat(targetWidth) / CGFloat(targetHeight)
            let cropSize = fitSize(aspect: aspect, maxWidth: availableWidth, maxHeight: availableHeight)

            ZStack {
                CropperScrollView(image: image, cropSize: cropSize, state: state, onCropChanged: onCropChanged)
                    .frame(width: cropSize.width, height: cropSize.height)
                    .overlay(CropOverlay(size: cropSize))
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
        }
    }

    private func fitSize(aspect: CGFloat, maxWidth: CGFloat, maxHeight: CGFloat) -> CGSize {
        let safeAspect = aspect.isFinite && aspect > 0 ? aspect : 1
        var width = max(1, maxWidth)
        var height = max(1, width / safeAspect)
        if height > maxHeight {
            height = max(1, maxHeight)
            width = max(1, height * safeAspect)
        }
        return CGSize(width: width, height: height)
    }
}

private struct CropOverlay: View {
    let size: CGSize

    var body: some View {
        Rectangle()
            .stroke(Color.white, lineWidth: 2)
            .shadow(color: .black.opacity(0.35), radius: 2, x: 0, y: 1)
            .frame(width: size.width, height: size.height)
    }
}

final class AdImageCropperState: ObservableObject {
    let objectWillChange = ObservableObjectPublisher()
    fileprivate var scrollView: UIScrollView?
    fileprivate var imageView: UIImageView?
    fileprivate var image: UIImage?

    func croppedImage() -> UIImage? {
        guard let scrollView, let image = image, let cgImage = image.cgImage else { return nil }

        let scale = 1.0 / scrollView.zoomScale
        let visibleRect = CGRect(
            x: scrollView.contentOffset.x * scale,
            y: scrollView.contentOffset.y * scale,
            width: scrollView.bounds.size.width * scale,
            height: scrollView.bounds.size.height * scale
        )

        let imageScale = image.scale
        var cropRect = CGRect(
            x: visibleRect.origin.x * imageScale,
            y: visibleRect.origin.y * imageScale,
            width: visibleRect.size.width * imageScale,
            height: visibleRect.size.height * imageScale
        ).integral

        let maxRect = CGRect(x: 0, y: 0, width: CGFloat(cgImage.width), height: CGFloat(cgImage.height))
        cropRect = cropRect.intersection(maxRect)
        guard let cropped = cgImage.cropping(to: cropRect) else { return nil }
        return UIImage(cgImage: cropped, scale: 1, orientation: .up)
    }
}

private struct CropperScrollView: UIViewRepresentable {
    let image: UIImage
    let cropSize: CGSize
    @ObservedObject var state: AdImageCropperState
    let onCropChanged: (UIImage?) -> Void

    func makeUIView(context: Context) -> UIScrollView {
        let normalized = normalizeOrientation(image)
        let scrollView = UIScrollView()
        scrollView.backgroundColor = UIColor.black
        scrollView.bounces = true
        scrollView.bouncesZoom = true
        scrollView.showsVerticalScrollIndicator = false
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.delegate = context.coordinator
        scrollView.clipsToBounds = true

        let imageView = UIImageView(image: normalized)
        imageView.contentMode = .scaleAspectFit
        imageView.frame = CGRect(origin: .zero, size: normalized.size)
        scrollView.addSubview(imageView)
        scrollView.contentSize = normalized.size

        state.scrollView = scrollView
        state.imageView = imageView
        state.image = normalized

        configureZoom(scrollView: scrollView, imageView: imageView, cropSize: cropSize)
        DispatchQueue.main.async {
            onCropChanged(state.croppedImage())
        }
        return scrollView
    }

    func updateUIView(_ uiView: UIScrollView, context: Context) {
        guard let imageView = state.imageView else { return }
        let normalized = normalizeOrientation(image)
        if imageView.image !== normalized {
            imageView.image = normalized
            imageView.frame = CGRect(origin: .zero, size: normalized.size)
            uiView.contentSize = normalized.size
            state.image = normalized
        }
        configureZoom(scrollView: uiView, imageView: imageView, cropSize: cropSize)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(state: state, onCropChanged: onCropChanged)
    }

    private func configureZoom(scrollView: UIScrollView, imageView: UIImageView, cropSize: CGSize) {
        guard cropSize.width.isFinite, cropSize.height.isFinite, cropSize.width > 0, cropSize.height > 0 else {
            return
        }
        guard imageView.bounds.width > 0, imageView.bounds.height > 0 else {
            return
        }
        scrollView.frame = CGRect(origin: .zero, size: cropSize)
        let scaleX = cropSize.width / imageView.bounds.width
        let scaleY = cropSize.height / imageView.bounds.height
        let minScale = max(scaleX, scaleY)
        scrollView.minimumZoomScale = minScale
        scrollView.maximumZoomScale = minScale * 4.0
        if scrollView.zoomScale < minScale || scrollView.zoomScale.isNaN {
            scrollView.zoomScale = minScale
        }

        let offsetX = max(0, (imageView.bounds.width * scrollView.zoomScale - cropSize.width) / 2)
        let offsetY = max(0, (imageView.bounds.height * scrollView.zoomScale - cropSize.height) / 2)
        scrollView.contentOffset = CGPoint(x: offsetX, y: offsetY)
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        let state: AdImageCropperState
        let onCropChanged: (UIImage?) -> Void

        init(state: AdImageCropperState, onCropChanged: @escaping (UIImage?) -> Void) {
            self.state = state
            self.onCropChanged = onCropChanged
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            return state.imageView
        }

        func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
            if !decelerate {
                onCropChanged(state.croppedImage())
            }
        }

        func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
            onCropChanged(state.croppedImage())
        }

        func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
            onCropChanged(state.croppedImage())
        }
    }

    private func normalizeOrientation(_ image: UIImage) -> UIImage {
        if image.imageOrientation == .up {
            return image
        }

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
    }
}
