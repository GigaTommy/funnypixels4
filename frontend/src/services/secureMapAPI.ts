/**
 * 安全地图API代理服务
 * 通过后端代理高德地图API请求，隐藏前端API密钥
 */

interface GeocodeResponse {
  status: string;
  info: string;
  geocodes?: Array<{
    formatted_address: string;
    province: string;
    city: string;
    district: string;
    adcode: string;
    location: {
      lng: number;
      lat: number;
    };
  }>;
}

interface POISearchResponse {
  status: string;
  info: string;
  pois?: Array<{
    id: string;
    name: string;
    location: {
      lng: number;
      lat: number;
    };
    address: string;
    cityname: string;
    adname: string;
  }>;
}

class SecureMapAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL;
  }

  /**
   * 地理编码：地址转坐标
   */
  async geocode(address: string): Promise<GeocodeResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/map/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Secure geocoding error:', error);
      throw error;
    }
  }

  /**
   * 逆地理编码：坐标转地址
   */
  async reverseGeocode(lng: number, lat: number): Promise<GeocodeResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/map/reverse-geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lng, lat }),
      });

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Secure reverse geocoding error:', error);
      throw error;
    }
  }

  /**
   * POI搜索
   */
  async searchPOI(keyword: string, city?: string): Promise<POISearchResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/map/search-poi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword, city }),
      });

      if (!response.ok) {
        throw new Error(`POI search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Secure POI search error:', error);
      throw error;
    }
  }

  /**
   * 获取搜索建议
   */
  async getSuggestions(keyword: string, city?: string): Promise<POISearchResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/map/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword, city }),
      });

      if (!response.ok) {
        throw new Error(`Suggestions failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Secure suggestions error:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const secureMapAPI = new SecureMapAPI();
export default secureMapAPI;