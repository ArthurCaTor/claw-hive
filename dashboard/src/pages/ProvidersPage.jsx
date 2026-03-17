// Providers Page
import { ProviderStatus } from '../components/providers';

export function ProvidersPage() {
  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 600 }}>
        Provider Status
      </h1>
      <ProviderStatus />
    </div>
  );
}

export default ProvidersPage;
