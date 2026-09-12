import http from 'k6/http';
import { check, sleep } from 'k6';
import type { Options } from 'k6/options';

export const options: Options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate==1']
  }
};

export default function performanceTest(): void {
  const response = http.get(`${__ENV.BASE_URL}/items/`);

  check(response, {
    'returns 200': (r) => r.status === 200
  });

  sleep(1);
}
