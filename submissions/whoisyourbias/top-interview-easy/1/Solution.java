import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        int[] answer = new int[2];
        HashMap<Integer, Integer> m = new HashMap<>();

        for (int i = 0; i < nums.length; i++) {
            int fv = target - nums[i];

            if (m.containsKey(fv)) {
                answer[0] = m.get(fv);
                answer[1] = i;
            }
            m.put(nums[i], i);
        }

        return answer;
    }
}
