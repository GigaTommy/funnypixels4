import { useState, useEffect } from 'react';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface LegalDocument {
    version: string;
    effective_date: string | null;
    url: string;
    file_url: string | null;
}

export interface LegalInfo {
    user_agreement: LegalDocument;
    privacy_policy: LegalDocument;
}

export const useLegalLinks = () => {
    const [legalInfo, setLegalInfo] = useState<LegalInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLegalInfo = async () => {
            try {
                const response = await fetch(`${config.API_BASE_URL}/api/system-config/public/latest-legal`);
                const result = await response.json();
                if (result.success) {
                    setLegalInfo(result.data);
                }
            } catch (error) {
                logger.error('Failed to fetch legal info:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLegalInfo();
    }, []);

    const openUserAgreement = () => {
        const url = legalInfo?.user_agreement.url || `${config.API_BASE_URL}/api/system-config/public/user-agreement`;
        window.open(url, '_blank');
    };

    const openPrivacyPolicy = () => {
        const url = legalInfo?.privacy_policy.url || `${config.API_BASE_URL}/api/system-config/public/privacy-policy`;
        window.open(url, '_blank');
    };

    return {
        legalInfo,
        loading,
        openUserAgreement,
        openPrivacyPolicy
    };
};
