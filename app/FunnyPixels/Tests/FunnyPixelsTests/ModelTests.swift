import XCTest
import MapKit
@testable import FunnyPixels

final class ModelTests: XCTestCase {

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        // 每个测试前执行
    }

    override func tearDown() {
        // 每个测试后执行
        super.tearDown()
    }

    // MARK: - PixelTile Tests

    func testPixelTileEncoding() throws {
        let pixel = Pixel(
            id: "test-1",
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "user-1"
        )

        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let tile = PixelTile(
            id: "tile-1",
            bounds: bounds,
            zoomLevel: 15,
            pixels: [pixel]
        )

        // 测试编码
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(tile)
        XCTAssertNotNil(data)

        // 测试解码
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(PixelTile.self, from: data)
        XCTAssertEqual(decoded.id, tile.id)
        XCTAssertEqual(decoded.pixels.count, 1)
    }

    func testTileBoundsContains() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let coord = CLLocationCoordinate2D(latitude: 39.5, longitude: 116.5)
        XCTAssertTrue(bounds.contains(coord))

        let outsideCoord = CLLocationCoordinate2D(latitude: 38.5, longitude: 116.5)
        XCTAssertFalse(bounds.contains(outsideCoord))
    }

    func testTileBoundsIntersection() {
        let bounds1 = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let bounds2 = TileBounds(
            minLatitude: 39.5,
            maxLatitude: 40.5,
            minLongitude: 116.5,
            maxLongitude: 117.5
        )

        XCTAssertTrue(bounds1.intersects(bounds2))
    }

    func testTileBoundsMapRect() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let mapRect = bounds.mapRect
        XCTAssertGreaterThan(mapRect.width, 0)
        XCTAssertGreaterThan(mapRect.height, 0)
    }

    func testTileBoundsCenter() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let center = bounds.center
        XCTAssertEqual(center.latitude, 39.5, accuracy: 0.001)
        XCTAssertEqual(center.longitude, 116.5, accuracy: 0.001)
    }

    func testPixelTileGenerateId() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let id = PixelTile.generateId(bounds: bounds, zoomLevel: 15)
        XCTAssertTrue(id.contains("15"))
        XCTAssertTrue(id.contains("39.0"))
        XCTAssertTrue(id.contains("116.0"))
    }

    func testPixelTileAddPixel() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        var tile = PixelTile(
            id: "tile-1",
            bounds: bounds,
            zoomLevel: 15,
            pixels: []
        )

        let pixel = Pixel(
            latitude: 39.5,
            longitude: 116.5,
            color: "#FF5733",
            authorId: "user-1"
        )

        tile.addPixel(pixel)
        XCTAssertEqual(tile.pixels.count, 1)
    }

    func testPixelTileRemovePixel() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        var tile = PixelTile(
            id: "tile-1",
            bounds: bounds,
            zoomLevel: 15,
            pixels: []
        )

        let pixel = Pixel(
            id: "test-pixel",
            latitude: 39.5,
            longitude: 116.5,
            color: "#FF5733",
            authorId: "user-1"
        )

        tile.addPixel(pixel)
        XCTAssertEqual(tile.pixels.count, 1)

        tile.removePixel(withId: "test-pixel")
        XCTAssertEqual(tile.pixels.count, 0)
    }

    func testPixelTileUpdatePixel() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        var tile = PixelTile(
            id: "tile-1",
            bounds: bounds,
            zoomLevel: 15,
            pixels: []
        )

        let pixel = Pixel(
            id: "test-pixel",
            latitude: 39.5,
            longitude: 116.5,
            color: "#FF5733",
            authorId: "user-1"
        )

        tile.addPixel(pixel)
        XCTAssertEqual(tile.pixels.first?.color, "#FF5733")

        let updatedPixel = Pixel(
            id: "test-pixel",
            latitude: 39.5,
            longitude: 116.5,
            color: "#00FF00",
            authorId: "user-1"
        )

        tile.updatePixel(updatedPixel)
        XCTAssertEqual(tile.pixels.first?.color, "#00FF00")
    }

    func testPixelTilePixelsWithColor() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let tile = PixelTile(
            id: "tile-1",
            bounds: bounds,
            zoomLevel: 15,
            pixels: [
                Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
                Pixel(latitude: 39.6, longitude: 116.6, color: "#FF5733", authorId: "user-2"),
                Pixel(latitude: 39.7, longitude: 116.7, color: "#00FF00", authorId: "user-3")
            ]
        )

        let redPixels = tile.pixels(withColor: "#FF5733")
        XCTAssertEqual(redPixels.count, 2)
    }

    func testPixelTilePixelsByAuthor() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        let tile = PixelTile(
            id: "tile-1",
            bounds: bounds,
            zoomLevel: 15,
            pixels: [
                Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
                Pixel(latitude: 39.6, longitude: 116.6, color: "#00FF00", authorId: "user-1"),
                Pixel(latitude: 39.7, longitude: 116.7, color: "#0000FF", authorId: "user-2")
            ]
        )

        let userPixels = tile.pixels(byAuthor: "user-1")
        XCTAssertEqual(userPixels.count, 2)
    }

    // MARK: - Pixel Tests

    func testPixelCodable() throws {
        let json = """
        {
            "id": "test-123",
            "latitude": 39.9042,
            "longitude": 116.4074,
            "color": "#FF5733",
            "authorId": "user-456",
            "createdAt": "2024-01-01T12:00:00Z",
            "updatedAt": "2024-01-01T12:00:00Z"
        }
        """

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let data = json.data(using: .utf8)!
        let pixel = try decoder.decode(Pixel.self, from: data)

        XCTAssertEqual(pixel.id, "test-123")
        XCTAssertEqual(pixel.color, "#FF5733")
    }

    func testPixelCoordinate() {
        let pixel = Pixel(
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test"
        )

        XCTAssertEqual(pixel.coordinate.latitude, 39.9042, accuracy: 0.0001)
        XCTAssertEqual(pixel.coordinate.longitude, 116.4074, accuracy: 0.0001)
    }

    func testPixelEncodingDecoding() throws {
        let pixel = Pixel(
            id: "test-pixel",
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test-user",
            createdAt: Date(),
            updatedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(pixel)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(Pixel.self, from: data)

        XCTAssertEqual(decoded.id, pixel.id)
        XCTAssertEqual(decoded.latitude, pixel.latitude, accuracy: 0.0001)
        XCTAssertEqual(decoded.longitude, pixel.longitude, accuracy: 0.0001)
        XCTAssertEqual(decoded.color, pixel.color)
        XCTAssertEqual(decoded.authorId, pixel.authorId)
    }

    // MARK: - WSMessage Tests

    func testWSMessageEncoding() throws {
        let pixel = Pixel(
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test"
        )

        let message = WSMessage(type: .pixelAdded, data: .pixel(pixel))

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(message)
        XCTAssertNotNil(data)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(WSMessage.self, from: data)

        XCTAssertEqual(decoded.type, .pixelAdded)
        switch decoded.data {
        case .pixel(let p):
            XCTAssertEqual(p.id, pixel.id)
        default:
            XCTFail("Expected pixel data")
        }
    }

    func testWSMessagePixelAdded() {
        let pixel = Pixel(
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test"
        )

        let message = WSMessage.pixelAdded(pixel)
        XCTAssertEqual(message.type, .pixelAdded)

        switch message.data {
        case .pixel(let p):
            XCTAssertEqual(p.id, pixel.id)
        default:
            XCTFail("Expected pixel data")
        }
    }

    func testWSMessagePixelUpdated() {
        let pixel = Pixel(
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test"
        )

        let message = WSMessage.pixelUpdated(pixel)
        XCTAssertEqual(message.type, .pixelUpdated)

        switch message.data {
        case .pixel(let p):
            XCTAssertEqual(p.id, pixel.id)
        default:
            XCTFail("Expected pixel data")
        }
    }

    func testWSMessagePixelRemoved() {
        let pixel = Pixel(
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test"
        )

        let message = WSMessage.pixelRemoved(pixel)
        XCTAssertEqual(message.type, .pixelRemoved)

        switch message.data {
        case .pixel(let p):
            XCTAssertEqual(p.id, pixel.id)
        default:
            XCTFail("Expected pixel data")
        }
    }

    func testWSMessageRegionUpdate() {
        let bounds = WSTileBounds(
            minLat: 39.0,
            maxLat: 40.0,
            minLng: 116.0,
            maxLng: 117.0,
            zoom: 15
        )

        let pixels = [
            Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
            Pixel(latitude: 39.6, longitude: 116.6, color: "#00FF00", authorId: "user-2")
        ]

        let message = WSMessage.regionUpdate(bounds, pixels: pixels)
        XCTAssertEqual(message.type, .regionUpdate)

        switch message.data {
        case .pixels(let p):
            XCTAssertEqual(p.count, 2)
        default:
            XCTFail("Expected pixels data")
        }
    }

    func testWSMessageError() {
        let errorMessage = "Test error message"
        let message = WSMessage.error(errorMessage)
        XCTAssertEqual(message.type, .error)

        switch message.data {
        case .error(let msg):
            XCTAssertEqual(msg, errorMessage)
        default:
            XCTFail("Expected error data")
        }
    }

    func testWSMessagePingPong() {
        let ping = WSMessage.ping()
        XCTAssertEqual(ping.type, .ping)

        switch ping.data {
        case .empty:
            break
        default:
            XCTFail("Expected empty data")
        }

        let pong = WSMessage.pong()
        XCTAssertEqual(pong.type, .pong)

        switch pong.data {
        case .empty:
            break
        default:
            XCTFail("Expected empty data")
        }
    }

    func testWSTileBoundsRegionId() {
        let bounds = WSTileBounds(
            minLat: 39.0,
            maxLat: 40.0,
            minLng: 116.0,
            maxLng: 117.0,
            zoom: 15,
            tileX: 100,
            tileY: 200
        )

        let regionId = bounds.regionId
        XCTAssertTrue(regionId.contains("15"))
        XCTAssertTrue(regionId.contains("100"))
        XCTAssertTrue(regionId.contains("200"))
    }

    func testWSTileBoundsContains() {
        let bounds = WSTileBounds(
            minLat: 39.0,
            maxLat: 40.0,
            minLng: 116.0,
            maxLng: 117.0,
            zoom: 15
        )

        XCTAssertTrue(bounds.contains(latitude: 39.5, longitude: 116.5))
        XCTAssertFalse(bounds.contains(latitude: 38.5, longitude: 116.5))
    }

    // MARK: - RenderingMode Tests

    func testRenderingMode() {
        let clustered = RenderingMode.clustered(gridSize: 0.01)
        XCTAssertTrue(clustered.requiresClustering)
        XCTAssertEqual(clustered.clusterGridSize, 0.01)

        let simplified = RenderingMode.simplified
        XCTAssertTrue(simplified.requiresSimplification)

        let full = RenderingMode.full
        XCTAssertFalse(full.requiresClustering)
        XCTAssertFalse(full.requiresSimplification)
    }

    func testRenderingModeDescription() {
        let clustered = RenderingMode.clustered(gridSize: 0.01)
        XCTAssertTrue(clustered.description.contains("Clustered"))

        let simplified = RenderingMode.simplified
        XCTAssertEqual(simplified.description, "Simplified")

        let full = RenderingMode.full
        XCTAssertEqual(full.description, "Full Detail")
    }

    func testPixelLODStrategy() {
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 39.9, longitude: 116.4),
            span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
        )

        let zoom = PixelLODStrategy.zoomLevel(from: region)
        XCTAssertGreaterThan(zoom, 12)

        let mode = PixelLODStrategy.renderingMode(from: region)
        XCTAssertTrue(mode == .full || mode == .simplified || mode == .clustered)
    }

    func testPixelLODStrategyRenderingModeForZoomLevel() {
        let clusteredMode = PixelLODStrategy.renderingMode(for: 10)
        XCTAssertTrue(clusteredMode.requiresClustering)

        let simplifiedMode = PixelLODStrategy.renderingMode(for: 14)
        XCTAssertTrue(simplifiedMode.requiresSimplification)

        let fullMode = PixelLODStrategy.renderingMode(for: 17)
        XCTAssertEqual(fullMode, .full)
    }

    func testPixelLODStrategyMaxRenderablePixels() {
        let lowZoom = PixelLODStrategy.maxRenderablePixels(for: 8)
        XCTAssertEqual(lowZoom, 1000)

        let mediumZoom = PixelLODStrategy.maxRenderablePixels(for: 13)
        XCTAssertEqual(mediumZoom, 5000)

        let highZoom = PixelLODStrategy.maxRenderablePixels(for: 18)
        XCTAssertEqual(highZoom, 20000)
    }

    func testPixelLODStrategyPixelDensity() {
        let density = PixelLODStrategy.pixelDensity(pixelCount: 100, area: 10.0)
        XCTAssertEqual(density, 10.0, accuracy: 0.01)

        let zeroAreaDensity = PixelLODStrategy.pixelDensity(pixelCount: 100, area: 0)
        XCTAssertEqual(zeroAreaDensity, 0)
    }

    func testPixelLODStrategyClusterPixels() {
        let pixels = [
            Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
            Pixel(latitude: 39.5001, longitude: 116.5001, color: "#FF5733", authorId: "user-2"),
            Pixel(latitude: 39.7, longitude: 116.7, color: "#00FF00", authorId: "user-3")
        ]

        let clusters = PixelLODStrategy.clusterPixels(pixels, gridSize: 0.01)
        XCTAssertGreaterThan(clusters.count, 0)
    }

    func testPixelClusterDominantColor() {
        let cluster = PixelCluster(
            id: "test-cluster",
            center: CLLocationCoordinate2D(latitude: 39.5, longitude: 116.5),
            pixels: [
                Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
                Pixel(latitude: 39.5001, longitude: 116.5001, color: "#FF5733", authorId: "user-2"),
                Pixel(latitude: 39.5002, longitude: 116.5002, color: "#00FF00", authorId: "user-3")
            ],
            gridSize: 0.01
        )

        XCTAssertEqual(cluster.dominantColor, "#FF5733")
    }

    func testPixelClusterColorDistribution() {
        let cluster = PixelCluster(
            id: "test-cluster",
            center: CLLocationCoordinate2D(latitude: 39.5, longitude: 116.5),
            pixels: [
                Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
                Pixel(latitude: 39.5001, longitude: 116.5001, color: "#FF5733", authorId: "user-2"),
                Pixel(latitude: 39.5002, longitude: 116.5002, color: "#00FF00", authorId: "user-3")
            ],
            gridSize: 0.01
        )

        let distribution = cluster.colorDistribution
        XCTAssertEqual(distribution["#FF5733"], 2)
        XCTAssertEqual(distribution["#00FF00"], 1)
    }

    func testPixelLODStrategyAdjustedMode() {
        let fullMode = RenderingMode.full
        let adjustedMode = PixelLODStrategy.adjustedMode(fullMode, for: 0.5)
        XCTAssertTrue(adjustedMode.requiresSimplification)

        let simplifiedMode = RenderingMode.simplified
        let adjustedMode2 = PixelLODStrategy.adjustedMode(simplifiedMode, for: 0.5)
        XCTAssertTrue(adjustedMode2.requiresClustering)
    }

    func testPixelLODStrategyEstimatedRenderTime() {
        let clusteredTime = PixelLODStrategy.estimatedRenderTime(pixelCount: 1000, mode: .clustered(gridSize: 0.01))
        XCTAssertEqual(clusteredTime, 10.0, accuracy: 0.1)

        let fullTime = PixelLODStrategy.estimatedRenderTime(pixelCount: 1000, mode: .full)
        XCTAssertEqual(fullTime, 100.0, accuracy: 0.1)
    }

    // MARK: - PixelAnnotation Tests

    func testPixelAnnotationCreation() {
        let pixel = Pixel(
            id: "test-pixel",
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test-user"
        )

        let annotation = PixelAnnotation(pixel: pixel)

        XCTAssertEqual(annotation.coordinate.latitude, 39.9042, accuracy: 0.0001)
        XCTAssertEqual(annotation.coordinate.longitude, 116.4074, accuracy: 0.0001)
        XCTAssertNotNil(annotation.title)
        XCTAssertNotNil(annotation.subtitle)
    }

    func testPixelAnnotationUpdateCoordinate() {
        let pixel = Pixel(
            id: "test-pixel",
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "test-user"
        )

        let annotation = PixelAnnotation(pixel: pixel)
        let newCoordinate = CLLocationCoordinate2D(latitude: 40.0, longitude: 117.0)

        annotation.updateCoordinate(newCoordinate)

        XCTAssertEqual(annotation.coordinate.latitude, 40.0, accuracy: 0.0001)
        XCTAssertEqual(annotation.coordinate.longitude, 117.0, accuracy: 0.0001)
    }

    func testPixelClusterAnnotation() {
        let pixels = [
            Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
            Pixel(latitude: 39.6, longitude: 116.6, color: "#00FF00", authorId: "user-2")
        ]

        let clusterAnnotation = PixelClusterAnnotation(pixels: pixels)

        XCTAssertEqual(clusterAnnotation.pixels.count, 2)
        XCTAssertNotNil(clusterAnnotation.title)
        XCTAssertEqual(clusterAnnotation.title, "2 Pixels")
    }

    func testPixelClusterAnnotationDominantColor() {
        let pixels = [
            Pixel(latitude: 39.5, longitude: 116.5, color: "#FF5733", authorId: "user-1"),
            Pixel(latitude: 39.5001, longitude: 116.5001, color: "#FF5733", authorId: "user-2"),
            Pixel(latitude: 39.5002, longitude: 116.5002, color: "#00FF00", authorId: "user-3")
        ]

        let clusterAnnotation = PixelClusterAnnotation(pixels: pixels)
        XCTAssertEqual(clusterAnnotation.dominantColor, "#FF5733")
    }
}
