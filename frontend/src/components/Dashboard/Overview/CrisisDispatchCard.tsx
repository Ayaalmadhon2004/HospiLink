import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const CrisisDispatchCard = () => {
  const { t } = useTranslation();
  return (
    <section className="bg-blue-800 rounded-lg p-6 text-white" aria-labelledby="crisis-dispatch-heading">
      <h2 id="crisis-dispatch-heading" className="text-lg font-bold mb-2">{t('dashboard.crisisDispatch')}</h2>
      <p className="text-blue-100 text-sm mb-4">{t('dashboard.crisisDispatchText')}</p>
      <Link
        to="/dispatch"
        className="block w-full bg-white/20 hover:bg-white/30 focus:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 text-white py-2 rounded-lg transition text-sm font-medium text-center"
        aria-label={t('dashboard.openDispatchLabel')}
      >
        {t('dashboard.openDispatch')}
      </Link>
    </section>
  );
};
