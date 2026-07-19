import java.util.*;

class Solution {
    public int removeDuplicates(int[] nums) {
        HashMap<Integer, Integer> m = new HashMap<>();
        
        int answer = 0;
        int curi = 0;
        for (int i = 0 ; i < nums.length; i++) {
            if (m.get(nums[i]) == null) {
                answer++;
                m.put(nums[i], i);
                nums[curi] = nums[i];
                curi++;
            }
        }
        return answer;
    }
}
