import java.util.*;
class Solution {
    public int[] solution(int[] arr, int[] delete_list) {
        List<Integer> array = new ArrayList<>(); 
        for (int elem : arr) {
            boolean flag = true; 
            for (int compare : delete_list) {
                if (elem == compare) {
                    flag = false; 
                    break; 
                } 
            }
            if (flag) {
                array.add(elem);
            }
        }
        
        int[] answer = new int[array.size()];
        for (int i = 0; i < array.size(); i++) {
            answer[i] = array.get(i);
        }
        
        return answer;
    }
}

// optimal 풀이 
// HashSet 으로 푸는 것이 더 좋음 
import java.util.*; 

class Solution {
    public int[] solution(int[] arr, int[] delete_list) {
        Set<Integer> delSet = new HashSet<>(); 
        
        // 삭제할 값을 저장 
        for (int elem : delete_list) {
            delSet.add(elem); 
        }
        
        // 결과를 담을 값 
        List<Integer> result = new ArrayList<>(); 
        
        for (int num : arr) {
            if (!delSet.contains(num)) {
                result.add(num); 
            }
        }
        
        // stream().mapToInt().toArray() 
        return result.stream()
            .mapToInt(Integer::intValue)
            .toArray(); 
    }
}