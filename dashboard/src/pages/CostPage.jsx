// Cost Page
import { CostBreakdown } from '../components/cost';

export function CostPage() {
  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 600 }}>
        Cost Breakdown
      </h1>
      <CostBreakdown />
    </div>
  );
}

export default CostPage;
