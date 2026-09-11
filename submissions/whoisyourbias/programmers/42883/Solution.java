import java.util.*;

class Solution {
    
    // nPr
    // N개 중에서 r개 고르기
    boolean[] visited;
    String[] selected;
    int max;
    String n;
    ArrayList<Integer> lst;
    public String solution(String number, int k) {
        String answer = "";
        
        visited = new boolean[number.length()];
        selected = new String[number.length()];
        max = number.length() - k;
        n = number;
        lst = new ArrayList<>();
        perm(0,0);
        Collections.sort(lst, (a,b) -> b-a);
        return String.valueOf(lst.get(0));
    }
    
    public void perm(int cur,int cnt) {
        if (cnt == max) {
            StringBuilder sb = new StringBuilder();
            
            for (int i  = 0; i < max; i++) {
                sb.append(selected[i]);
            }
            
            if (sb.length() == 0)
                sb.append("0");
            lst.add(Integer.parseInt(sb.toString()));
            return;
        }
        if (cur >= n.length())
            return;
        selected[cnt] = String.valueOf(n.charAt(cur));
        perm(cur + 1, cnt + 1);

        selected[cnt] = null;
        perm(cur + 1, cnt);
    }
}