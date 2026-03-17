// Captures Page
import { CaptureViewer } from '../components/captures';

export function CapturesPage() {
  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 600 }}>
        LLM Captures
      </h1>
      <CaptureViewer />
    </div>
  );
}

export default CapturesPage;
