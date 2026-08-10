import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

class Solution {

    public List<List<Integer>> threeSum(int[] nums) {
        
        // nums[i] , nums[j] , nums[k]
        // i != j && i != k && j != k && 
        // nums[i] + nums[j] + nums[k] == 0;

        List<List<Integer>> ans = new ArrayList<>();

        Arrays.sort(nums);
        for(int i = 0; i < nums.length - 2; i++) {
            if(i > 0 && nums[i] == nums[i - 1])            
                continue;
            
            int l = i + 1;
            int r = nums.length - 1;

            while (l < r) {
                int sum = nums[i] + nums[l] + nums[r];
                if(sum < 0) {
                    l++;
                }
                if(sum > 0) {
                    r--;
                }

                if(sum == 0) {
                    List<Integer> temp = new ArrayList<Integer>();
                    temp.add(nums[i]);
                    temp.add(nums[l]);
                    temp.add(nums[r]);

                    ans.add(temp);
                    l++;
                    r--;
                    while(l < r && nums[l] == nums[l - 1])
                    l++;
                    while(l < r && nums[r] == nums[r + 1])
                    r--;

                }
            }


        }

        


        return ans;

    }
}