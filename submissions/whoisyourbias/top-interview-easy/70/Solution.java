import java.util.HashMap;

class Solution {

	public int climbStairs(int n) {
		if (n <= 3) {
			return n;
		}

		HashMap<Integer, Integer> m = new HashMap<>();
		m.put(1, 1);
		m.put(2, 2);
		m.put(3, 3);
		for (int i = 4; i <= n; i++) {
			// System.out.printf("%d = %d + %d\n", i, m.get(i - 1) , m.get(i - 2));
			m.put(i, m.get(i - 1) + m.get(i - 2));
		}

		return m.get(n);
	}
}
