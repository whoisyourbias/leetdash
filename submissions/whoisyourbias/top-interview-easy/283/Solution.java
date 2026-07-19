class Solution {
    public void moveZeroes(int[] nums) {
        int i = 0;
        int zeroCount = 0;
        while (i < nums.length) {
            int cur = nums[i];

            if (cur == 0) {
                zeroCount++;
            } else if (zeroCount != 0) {
                nums[i - zeroCount] = cur;
                nums[i] = 0;
            }
            i++;
        }
    }
}
