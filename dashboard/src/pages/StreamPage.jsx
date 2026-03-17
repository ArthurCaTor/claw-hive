// Stream Page
import { ContextStreamInspector } from '../components/stream';

export function StreamPage() {
  return (
    <div style={{ height: 'calc(100vh - 80px)' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 600 }}>
        Context Stream
      </h1>
      <div style={{ height: 'calc(100% - 60px)' }}>
        <ContextStreamInspector />
      </div>
    </div>
  );
}

export default StreamPage;
