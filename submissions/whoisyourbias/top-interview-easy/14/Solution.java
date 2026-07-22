import java.util.Arrays;
import java.util.Comparator;

class Solution {
    public String longestCommonPrefix(String[] strs) {
        if (strs.length == 0) {
			return "";
		}

		Comparator<String> n = new StringLengthComparator();
		Arrays.sort(strs, n);

		int i = 0;
        String prefix = "";
		boolean fin = false;
        while (i < strs[0].length() + 1 && fin == false) {
			prefix = strs[0].substring(0, Math.min(i + 1, strs[0].length()));
			fin = false;
            for (String s : strs) {
				if (!s.startsWith(prefix)) {
                    fin = true;
					break;
				}
			}
			i++;
		}
        return strs[0].substring(0, i - 1);
    }

	// sort Comparator by String Length
	/**
	 *  @implNote String 클래스에 대해서 sort시 전달하는 커스텀 비교클래스
	 *  Comparator 제네릭함수를 String으로 만들고, 이 인터페이스에 대해서 구현체 생성
	 *  이때, Comparator 인터페이스는 compare, equals 같은 메서드를 구현하라고되어있음.
	 *
	 *  이때, 제네릭으로 전달한 인자에 default compare, equals를 기본으로 사용하되,
	 *  메서드 오버라이딩을 통해 별도로 정의할 수 있음.
	 * */
	public class StringLengthComparator implements Comparator<String> {
		@Override
		public int compare(String a, String b){
			return a.length() - b.length();
		}
	}
}
