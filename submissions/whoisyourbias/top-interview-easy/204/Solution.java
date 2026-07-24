import java.util.*;

class Solution {
	// 에라토스테네스의 체 사용
	public int countPrimes(int n) {
		if (n < 3)
			return 0;

		boolean[] sieve = new boolean[n];

		int c = n / 2; // 소수의 개수는 항상 n의 절반이하로있음.

		// 3이상의 짝수는 모두 소수가아님
		for (int i = 3; i * i < n; i += 2) {
			if (sieve[i])
				continue;
			// 소수판정시작은 i*i부터함,
			// 최소9부터 시작.
			// 2*i를해서 짝수판정을 아예 제외함.
			// i= 3일때 j=9, 15,21 ...
			// i = 5 j =25,35,45...
			for (int j = i * i; j < n; j += 2 * i) {
				if (!sieve[j]) {
					--c;
					sieve[j] = true;
				}
			}
		}

		return c;
	}
}
