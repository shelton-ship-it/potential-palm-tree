'use client';
import { useTranslation } from 'react-i18next';
import { PlansPage } from '@/_shared';

export default function Page() {
  const { t } = useTranslation();

  const FEATURES = {
    free: [
      t('plans.featuresFreeLimited'),
      t('plans.featuresFreeAds'),
    ],
    monthly: [
      t('plans.featuresPaidAccess'),
      t('plans.featuresPaidNoAds'),
      t('plans.featuresPaidPriority'),
      t('plans.featuresPaidSupport'),
    ],
    quarterly: [
      t('plans.featuresQuarterlyEverything'),
      t('plans.featuresQuarterlySave'),
    ],
    annual: [
      t('plans.featuresAnnualEverything'),
      t('plans.featuresAnnualPrice'),
      t('plans.featuresAnnualEarlyAccess'),
    ],
  };

  return <PlansPage features={FEATURES} />;
}
