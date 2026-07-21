import java.util.*;

class Solution {
	public int reverse(int x) {
		int sign = 1;

		if (x < 0) {
			sign = -1;
		}

		int c = x;
		LinkedList<Integer> s = new LinkedList<>();
		while (c != 0) {
			int v = Math.abs(c % 10);
			s.add(v);
			c /= 10;
		}
		int v = 0;
		for (int i = 0; i < s.size(); i++) {
			v = v * 10 + s.get(i);
		}
		int v2 = v * sign;
		int i = 0;
		int pow = s.size() - 1;
		while (v2 != 0) {
			int p = getPow(pow);
			if (Math.abs(v2 / p) != s.get(i)) {
				return 0;
			}
			i++;
			pow--;
			v2 %= p;
		}

		return v * sign;
	}

	int getPow(int n) {
		if (n == 0) {
			return 1;
		}
		return 10 * getPow(n - 1);
	}

	void swap(int[] a, int i, int j) {
		int tmp = a[i];
		a[i] = a[j];
		a[j] = tmp;
	}
}
