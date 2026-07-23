class Solution {
	public int maxProfit(int[] prices) {
		int min = Integer.MAX_VALUE;
		int maximized = Integer.MIN_VALUE;
		for (int i = 0; i < prices.length; i++) {
			if (i >= 1) {
				if (min > prices[i - 1]) {
					min = prices[i - 1];
				}
			}

			if (maximized < prices[i] - min && (prices[i] - min > 0)) {
				maximized = prices[i] - min;
			}
		}
		return maximized == Integer.MIN_VALUE ? 0 : maximized;
	}
}
