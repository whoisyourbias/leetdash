class Solution {
	public int rob(int[] nums) {
		if (nums.length == 1)
			return nums[0];
		if (nums.length == 2)
			return Math.max(nums[0], nums[1]);
		nums[1] = Math.max(nums[0], nums[1]);
		for (int i = 2; i < nums.length; i++) {
			if (nums[i - 2] + nums[i] > nums[i - 1]) {
				nums[i] = nums[i - 2] + nums[i];
			} else {
				nums[i] = nums[i - 1];
			}
		}

		int len = nums.length;
		return Math.max(nums[len - 1], nums[len - 2]);
	}
}
