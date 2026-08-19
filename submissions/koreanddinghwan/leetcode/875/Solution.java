import java.util.*;

class Solution {
	public int minEatingSpeed(int[] piles, int h) {
		Arrays.sort(piles);

		int max = piles[piles.length - 1];

		int left = 1;
		int right = max;

		while (left < right) {
			double mid = left + (right - left) / 2;

			// check mid
			int cur_h = 0;
			for (int i = 0; i < piles.length; i++) {
				cur_h += (int) Math.ceil(piles[i] / mid);
			}
			if (cur_h > h)
				left = (int) mid + 1;
			else
				right = (int) mid;
		}
		return left;
	}
}
