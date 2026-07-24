// kadane's algorithm
//
//
//
//
// maximum subarray 는 배열을 인덱스로 돌면서
// 현재 보고있는 값이 이전 인덱스까지의 배열의합보다 큰지 작은지를 확인한다.

class Solution {
	public int maxSubArray(int[] nums) {
		// int j = 0;
		// /현재 인덱스 기준, 원래 수열을 연장할까말까
		int max = nums[0];

		// 과거 수열들 중 최대값
		int curMax = max;
		for (int i = 1; i < nums.length; i++) {
			max = Math.max(max + nums[i], nums[i]);
			curMax = Math.max(max, curMax);
		}
		return curMax;
	}
}
