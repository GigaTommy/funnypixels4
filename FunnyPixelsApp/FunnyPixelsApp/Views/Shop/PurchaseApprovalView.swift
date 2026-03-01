import SwiftUI
import PhotosUI
import MapKit
import CoreLocation

struct PurchaseApprovalView: View {
    let item: ShopService.StoreItem
    let userPoints: Int
    let onConfirm: (String, String, String, String?, Date?) -> Void // Title, Desc, Base64Image, LocationJSON?, Time?
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: UIImage?
    @State private var selectedDate: Date = Date()
    @State private var adPreviewImage: UIImage?
    @State private var isGeneratingPreview = false
    @StateObject private var cropperState = AdImageCropperState()

    // Map states
    @State private var region: MKCoordinateRegion
    @State private var selectedLocation: CLLocationCoordinate2D?
    @State private var locationName: String?
    @State private var showMap = false

    // Default Shanghai fallback
    private static let fallbackCenter = CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737)

    private var canAfford: Bool { userPoints >= item.pricePoints }

    init(item: ShopService.StoreItem, userPoints: Int = 0, onConfirm: @escaping (String, String, String, String?, Date?) -> Void) {
        self.item = item
        self.userPoints = userPoints
        self.onConfirm = onConfirm
        let center = MapController.shared.cachedCenter ?? Self.fallbackCenter
        _region = State(initialValue: MKCoordinateRegion(
            center: center,
            span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        ))
    }

    var isAdvertisement: Bool { item.itemType == "advertisement" }

    @State private var showDisclaimer = false
    @State private var isUploading = false
    @State private var uploadError: String?
    @State private var showErrorAlert = false

    var body: some View {
        NavigationStack {
            Form {
                Section(NSLocalizedString("approval.section.basic_info", comment: "")) {
                    TextField(isAdvertisement ? NSLocalizedString("approval.ad_title", comment: "") : NSLocalizedString("approval.pattern_name", comment: ""), text: $title)
                    TextField(isAdvertisement ? NSLocalizedString("approval.ad_desc", comment: "") : NSLocalizedString("approval.desc", comment: ""), text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    if isAdvertisement {
                        Text(NSLocalizedString("approval.ad_hint", comment: ""))
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        Text(NSLocalizedString("approval.pattern_hint", comment: ""))
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                }

                Section(NSLocalizedString("approval.section.image", comment: "")) {
                    PhotosPicker(selection: $selectedItem, matching: .images) {
                        if let selectedImage {
                            Image(uiImage: selectedImage)
                                .resizable()
                                .scaledToFit()
                                .frame(height: 200)
                        } else {
                            HStack {
                                Image(systemName: "photo")
                                Text(NSLocalizedString("approval.select_image", comment: ""))
                            }
                            .foregroundColor(.blue)
                        }
                    }
                    .onChange(of: selectedItem) { _, newItem in
                        Task {
                            if let data = try? await newItem?.loadTransferable(type: Data.self),
                               let image = UIImage(data: data) {
                                selectedImage = image
                                if isAdvertisement {
                                    generateAdPreview(for: image)
                                } else {
                                    adPreviewImage = nil
                                }
                            }
                        }
                    }
                    HStack {
                        Text(NSLocalizedString("approval.image_hint", comment: ""))
                            .font(.footnote)
                            .foregroundColor(.secondary)
                        Spacer()
                        Button {
                            showDisclaimer = true
                        } label: {
                            Image(systemName: "info.circle")
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                if isAdvertisement {
                    Section(NSLocalizedString("approval.section.ad_preview", comment: "")) {
                        if isGeneratingPreview {
                            HStack {
                                Spacer()
                                ProgressView(NSLocalizedString("approval.preview.generating", comment: ""))
                                Spacer()
                            }
                        } else if let image = selectedImage, let dims = adTargetDimensions() {
                            AdImageCropperView(
                                image: image,
                                targetWidth: dims.width,
                                targetHeight: dims.height,
                                state: cropperState
                            ) { cropped in
                                generateAdPreview(for: cropped ?? image)
                            }
                            .frame(height: 260)
                            .background(Color.black)
                            .cornerRadius(8)

                            if let preview = adPreviewImage {
                                Image(uiImage: preview)
                                    .interpolation(.none)
                                    .resizable()
                                    .scaledToFit()
                                    .frame(height: 140)
                                    .background(Color.white)
                                    .cornerRadius(8)
                            } else {
                                HStack {
                                    Spacer()
                                    ProgressView(NSLocalizedString("approval.preview.generating", comment: ""))
                                    Spacer()
                                }
                            }

                            Text(String(format: NSLocalizedString("approval.preview.size", comment: ""), dims.width, dims.height))
                                .font(.footnote)
                                .foregroundColor(.secondary)
                            Text(NSLocalizedString("approval.preview.crop_tip", comment: ""))
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        } else {
                            Text(NSLocalizedString("approval.preview.empty", comment: ""))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                if isAdvertisement {
                    Section(NSLocalizedString("approval.section.deploy", comment: "")) {
                        DatePicker(NSLocalizedString("approval.deploy_time", comment: ""), selection: $selectedDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])

                        Button(action: { showMap = true }) {
                            HStack {
                                Text(NSLocalizedString("approval.deploy_location", comment: ""))
                                Spacer()
                                if let name = locationName {
                                    Text(name)
                                        .foregroundColor(.secondary)
                                } else if selectedLocation != nil {
                                    Text(NSLocalizedString("approval.location.unknown", comment: ""))
                                        .foregroundColor(.secondary)
                                } else {
                                    Text(NSLocalizedString("approval.tap_to_select", comment: ""))
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        Text(NSLocalizedString("approval.location_hint", comment: ""))
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                }

                Section(NSLocalizedString("approval.section.price_info", comment: "费用信息")) {
                    HStack {
                        Text(NSLocalizedString("approval.price_label", comment: "商品价格"))
                        Spacer()
                        Text(String(format: NSLocalizedString("shop.price_points", comment: ""), item.pricePoints))
                            .fontWeight(.medium)
                            .foregroundColor(AppColors.primary)
                    }
                    HStack {
                        Text(NSLocalizedString("approval.balance_label", comment: "当前积分"))
                        Spacer()
                        Text(String(format: NSLocalizedString("shop.price_points", comment: ""), userPoints))
                            .fontWeight(.medium)
                            .foregroundColor(canAfford ? .green : .red)
                    }
                    if !canAfford {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.red)
                            Text(NSLocalizedString("shop.insufficient_points.hint", comment: "积分不足，请先充值"))
                                .font(.footnote)
                                .foregroundColor(.red)
                        }
                    }
                }

                Section {
                    if isUploading {
                        HStack {
                            Spacer()
                            ProgressView(NSLocalizedString("approval.uploading", comment: ""))
                            Spacer()
                        }
                    } else {
                        Button(action: submit) {
                            Text(NSLocalizedString("approval.submit", comment: ""))
                                .frame(maxWidth: .infinity)
                                .foregroundColor(.white)
                        }
                        .listRowBackground(canAfford ? Color.blue : Color.gray)
                        .disabled(!canAfford || title.isEmpty || selectedImage == nil || (isAdvertisement && selectedLocation == nil))
                    }
                }
            }
            .navigationTitle(isAdvertisement ? NSLocalizedString("approval.nav_title.ad", comment: "") : NSLocalizedString("approval.nav_title.flag", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.cancel", comment: "")) { dismiss() }
                    .disabled(isUploading)
                }
            }
            .sheet(isPresented: $showMap) {
                LocationPickerView(selectedLocation: $selectedLocation, locationName: $locationName)
            }
            .alert(NSLocalizedString("disclaimer.title", comment: ""), isPresented: $showDisclaimer) {
                Button(NSLocalizedString("common.confirm", comment: ""), role: .cancel) { }
            } message: {
                Text(NSLocalizedString("disclaimer.ad_image", comment: ""))
            }
            .alert(NSLocalizedString("approval.upload_failed", comment: ""), isPresented: $showErrorAlert) {
                Button(NSLocalizedString("common.confirm", comment: ""), role: .cancel) { }
            } message: {
                Text(uploadError ?? NSLocalizedString("approval.unknown_error", comment: ""))
            }
        }
    }

    private func submit() {
        guard let image = selectedImage else { return }
        let uploadImage = isAdvertisement ? (cropperState.croppedImage() ?? image) : image
        guard let imageData = uploadImage.jpegData(compressionQuality: 0.7) else { return }

        isUploading = true

        Task {
            do {
                // 1. Upload to S3/CDN and get URL
                let imageUrl = try await CDNService.shared.uploadImageAndGetUrl(data: imageData)

                // 2. Submit with URL
                await MainActor.run {
                    var locationJson: String? = nil
                    if let loc = selectedLocation {
                        let addressStr = locationName ?? ""
                        let escapedAddress = addressStr
                            .replacingOccurrences(of: "\\", with: "\\\\")
                            .replacingOccurrences(of: "\"", with: "\\\"")
                        locationJson = "{\"lat\": \(loc.latitude), \"lng\": \(loc.longitude), \"address\": \"\(escapedAddress)\"}"
                    }

                    onConfirm(title, description, imageUrl, locationJson, isAdvertisement ? selectedDate : nil)
                    dismiss()
                    isUploading = false
                }
            } catch {
                Logger.error("❌ Upload failed: \(error)")
                await MainActor.run {
                    uploadError = String(format: NSLocalizedString("approval.image_upload_failed", comment: ""), error.localizedDescription)
                    showErrorAlert = true
                    isUploading = false
                }
            }
        }
    }

    private func generateAdPreview(for image: UIImage) {
        guard let dims = adTargetDimensions() else {
            adPreviewImage = nil
            return
        }

        isGeneratingPreview = true
        let targetW = dims.width
        let targetH = dims.height

        Task.detached(priority: .userInitiated) {
            let preview = await AdImagePreviewProcessor.shared.generatePreview(
                image: image,
                targetWidth: targetW,
                targetHeight: targetH
            )
            await MainActor.run {
                adPreviewImage = preview
                isGeneratingPreview = false
            }
        }
    }

    private func adTargetDimensions() -> (width: Int, height: Int)? {
        if let w = item.metadata?.width, let h = item.metadata?.height, w > 0, h > 0 {
            return (w, h)
        }

        if let sizeType = item.metadata?.sizeType, let adSize = AdSizeType(rawValue: sizeType) {
            return adSize.dimensions
        }

        if let parsed = parseDimensions(from: item.name) {
            return parsed
        }
        if let parsed = parseDimensions(from: item.description) {
            return parsed
        }

        return AdSizeType.square.dimensions
    }

    private func parseDimensions(from text: String) -> (width: Int, height: Int)? {
        let normalized = text.replacingOccurrences(of: "×", with: "x")
        let pattern = "(\\d{2,4})\\s*[xX]\\s*(\\d{2,4})"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(normalized.startIndex..<normalized.endIndex, in: normalized)
        guard let match = regex.firstMatch(in: normalized, range: range),
              match.numberOfRanges == 3,
              let wRange = Range(match.range(at: 1), in: normalized),
              let hRange = Range(match.range(at: 2), in: normalized),
              let w = Int(normalized[wRange]),
              let h = Int(normalized[hRange]) else {
            return nil
        }
        return (w, h)
    }
}

// Simple Location Picker
struct LocationPickerView: View {
    @Binding var selectedLocation: CLLocationCoordinate2D?
    @Binding var locationName: String?
    @Environment(\.dismiss) private var dismiss

    @State private var position: MapCameraPosition
    @State private var currentCenter: CLLocationCoordinate2D
    @State private var currentAddress: String = NSLocalizedString("approval.location.loading", comment: "")
    @State private var geocodeTask: Task<Void, Never>?

    private let geocoder = CLGeocoder()

    // Default Shanghai fallback
    private static let fallbackCenter = CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737)

    init(selectedLocation: Binding<CLLocationCoordinate2D?>, locationName: Binding<String?>) {
        _selectedLocation = selectedLocation
        _locationName = locationName
        let center = MapController.shared.cachedCenter ?? Self.fallbackCenter
        _position = State(initialValue: .region(MKCoordinateRegion(
            center: center,
            span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        )))
        _currentCenter = State(initialValue: center)
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Map(position: $position) {
                    UserAnnotation()
                }
                .onMapCameraChange(frequency: .continuous) { context in
                    currentCenter = context.camera.centerCoordinate
                    debounceGeocode(coordinate: currentCenter)
                }

                Image(systemName: "mappin")
                    .font(.title)
                    .foregroundColor(.red)
                    .padding(.bottom, 20)
                    .frame(maxHeight: .infinity)

                // Address card at bottom
                HStack {
                    Image(systemName: "mappin.circle.fill")
                        .foregroundColor(.red)
                    Text(currentAddress)
                        .font(.subheadline)
                        .lineLimit(2)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            .navigationTitle(NSLocalizedString("approval.select_location", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.cancel", comment: "")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(NSLocalizedString("common.confirm", comment: "")) {
                        selectedLocation = currentCenter
                        // Set locationName from the current address (strip "nearby" wrapper if it's the unknown fallback)
                        locationName = currentAddress == NSLocalizedString("approval.location.loading", comment: "")
                            ? NSLocalizedString("approval.location.unknown", comment: "")
                            : currentAddress
                        dismiss()
                    }
                }
            }
        }
    }

    private func debounceGeocode(coordinate: CLLocationCoordinate2D) {
        geocodeTask?.cancel()
        currentAddress = NSLocalizedString("approval.location.loading", comment: "")
        geocodeTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 0.3s debounce
            guard !Task.isCancelled else { return }
            await reverseGeocode(coordinate: coordinate)
        }
    }

    private func reverseGeocode(coordinate: CLLocationCoordinate2D) async {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        do {
            let placemarks = try await geocoder.reverseGeocodeLocation(location)
            guard !Task.isCancelled, let placemark = placemarks.first else { return }

            // Priority: name > thoroughfare > subLocality > locality
            let bestName = placemark.name
                ?? placemark.thoroughfare
                ?? placemark.subLocality
                ?? placemark.locality

            await MainActor.run {
                if let bestName {
                    currentAddress = String(format: NSLocalizedString("approval.location.nearby", comment: ""), bestName)
                } else {
                    currentAddress = NSLocalizedString("approval.location.unknown", comment: "")
                }
            }
        } catch {
            guard !Task.isCancelled else { return }
            await MainActor.run {
                currentAddress = NSLocalizedString("approval.location.unknown", comment: "")
            }
        }
    }
}
