import java.util.Scanner;

public class Solution {

	public static void main(String args[]) throws Exception
	{
		Scanner sc = new Scanner(System.in);
		int T= sc.nextInt();
		
		for(int test_case=1; test_case<=T;test_case++) {
			String field = sc.next();
			int bo = 0;
			for (int i = 0; i < field.length()-1; i++) {
				char a = field.charAt(i);
				char b = field.charAt(i+1);
				if(a=='('&&(b=='|'||b==')')) {
					bo++;
				}else if(a=='|'&&b==')') {
					bo++;
				}
			}
			System.out.println("#"+test_case+" "+ bo);
			
		}
		sc.close();
	}
}
		