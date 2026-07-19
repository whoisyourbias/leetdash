import java.util.*;

class Solution {
    public boolean containsDuplicate(int[] nums) {
        HashMap<Integer, Integer> m = new HashMap<>();

        for (int i = 0; i  < nums.length; i++) {
            if (m.get(nums[i]) != null) {
                return true;
            }

            m.put(nums[i], 1);
        }
        return false;
    }
}
