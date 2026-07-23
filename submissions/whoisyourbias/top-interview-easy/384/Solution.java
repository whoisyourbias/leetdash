import java.util.Random;

class Solution {
	int[] nums;

	public Solution(int[] nums) {
		this.nums = nums;
	}

	public int[] reset() {
		return nums.clone();
	}

	public int[] shuffle() {
		Random rand = new Random();
		int[] shuffled = this.nums.clone();
		for (int i = this.nums.length - 1; i > 0; i--) {
			int randIdx = rand.nextInt(i + 1);

			int temp = shuffled[randIdx];
			shuffled[randIdx] = shuffled[i];
			shuffled[i] = temp;

		}
		return shuffled;
	}
}

/**
 * Your Solution object will be instantiated and called as such:
 * Solution obj = new Solution(nums);
 * int[] param_1 = obj.reset();
 * int[] param_2 = obj.shuffle();
 */
