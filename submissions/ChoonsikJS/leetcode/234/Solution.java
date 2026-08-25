import java.util.ArrayList;
import java.util.List;

class Solution {
    public boolean isPalindrome(ListNode head) {
        List<Integer> list = new ArrayList<>();
        ListNode curr = head;
        
        // 1. 연결 리스트 -> ArrayList 변환
        while (curr != null) {
            list.add(curr.val);
            curr = curr.next;
        }

        // 2. 양쪽 끝에서 투 포인터로 비교
        int left = 0;
        int right = list.size() - 1;
        
        while (left < right) {
            // Integer 객체 비교 시 .equals() 사용 권장
            if (!list.get(left).equals(list.get(right))) {
                return false;
            }
            left++;
            right--;
        }
        
        return true;
    }
}
