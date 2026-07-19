import java.util.*;

class Solution {
    public void rotate(int[] nums, int k) {
        
            k = k % nums.length;
        
        if (k == 0 || nums.length == 1 || k == nums.length) {
            return;
        }
        
        
        
        reverse(nums, 0, nums.length - 1); // from to
        System.out.println(Arrays.toString(nums));
        reverse(nums, 0, k - 1);
        System.out.println(Arrays.toString(nums));
        reverse(nums, k, nums.length - k - 1);
        System.out.println(Arrays.toString(nums));
    }

    void reverse(int[] nums, int i, int k) {

        for (int a = 0; a <= k / 2; a++) {
            int tmp = nums[i + k - a];
            nums[i + k - a] = nums[a + i];
            nums[a + i] = tmp;
        }
    }
}
