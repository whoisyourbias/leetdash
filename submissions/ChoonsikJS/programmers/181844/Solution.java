import java.util.*;

class Solution {
    public int[] solution(int[] arr, int[] delete_list) {
        Set<Integer> del_list = new HashSet<>();
        for (int x : delete_list) del_list.add(x);
        
        List<Integer> tmp = new ArrayList<>();
        for (int x : arr){
            if (!del_list.contains(x)) tmp.add(x);
        }
        
        return tmp.stream()
                  .mapToInt(Integer::intValue)
                  .toArray();
    }
}