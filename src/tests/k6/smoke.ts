import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';

export const options: Options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate==0']
  }
};

export default function smokeTest(): void {
  const response = http.get(`${__ENV.BASE_URL}/items/`);

  check(response, {
    'returns 200': (r) => r.status === 200,
    'returns a JSON array': (r) => {
      try {
        return Array.isArray(r.json());
      } catch {
        return false;
      }
    }
  });
}
